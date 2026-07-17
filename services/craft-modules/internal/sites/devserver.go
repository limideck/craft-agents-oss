package sites

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

const previewPortBase = 5400

type previewProc struct {
	cmd  *exec.Cmd
	port int
	url  string
}

// PreviewManager tracks Vite dev servers per site (ports 5400+).
type PreviewManager struct {
	mu    sync.Mutex
	procs map[string]*previewProc // siteID → proc
	ports map[int]string          // port → siteID
}

func NewPreviewManager() *PreviewManager {
	return &PreviewManager{
		procs: map[string]*previewProc{},
		ports: map[int]string{},
	}
}

func (pm *PreviewManager) allocatePortLocked(siteID string) (int, error) {
	for port := previewPortBase; port < previewPortBase+200; port++ {
		if owner, ok := pm.ports[port]; ok && owner != siteID {
			continue
		}
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err != nil {
			continue
		}
		_ = ln.Close()
		return port, nil
	}
	return 0, fmt.Errorf("no free preview port in %d–%d", previewPortBase, previewPortBase+199)
}

func (pm *PreviewManager) Stop(siteID string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	return pm.stopLocked(siteID)
}

func (pm *PreviewManager) stopLocked(siteID string) error {
	proc, ok := pm.procs[siteID]
	if !ok {
		return nil
	}
	delete(pm.procs, siteID)
	if proc.port != 0 {
		delete(pm.ports, proc.port)
	}
	if proc.cmd == nil || proc.cmd.Process == nil {
		return nil
	}
	_ = proc.cmd.Process.Signal(syscall.SIGTERM)
	done := make(chan struct{})
	go func() {
		_, _ = proc.cmd.Process.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		_ = proc.cmd.Process.Kill()
		<-done
	}
	return nil
}

func (pm *PreviewManager) Status(siteID string) (port int, url string, running bool) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	proc, ok := pm.procs[siteID]
	if !ok || proc.cmd == nil || proc.cmd.Process == nil {
		return 0, "", false
	}
	return proc.port, proc.url, true
}

// Start ensures deps, launches Vite on an allocated port, and returns preview info.
func (pm *PreviewManager) Start(ctx context.Context, siteID, sitePath string) (port int, url string, err error) {
	pm.mu.Lock()
	if existing, ok := pm.procs[siteID]; ok && existing.cmd != nil && existing.cmd.Process != nil {
		port, url = existing.port, existing.url
		pm.mu.Unlock()
		return port, url, nil
	}
	_ = pm.stopLocked(siteID)

	port, err = pm.allocatePortLocked(siteID)
	if err != nil {
		pm.mu.Unlock()
		return 0, "", err
	}
	pm.ports[port] = siteID
	pm.mu.Unlock()

	if err := ensureDeps(ctx, sitePath); err != nil {
		pm.mu.Lock()
		delete(pm.ports, port)
		pm.mu.Unlock()
		return 0, "", err
	}

	url = fmt.Sprintf("http://127.0.0.1:%d", port)
	cmd, err := startVite(ctx, sitePath, port)
	if err != nil {
		pm.mu.Lock()
		delete(pm.ports, port)
		pm.mu.Unlock()
		return 0, "", err
	}

	if err := waitForPort(ctx, port, 60*time.Second); err != nil {
		_ = cmd.Process.Kill()
		_, _ = cmd.Process.Wait()
		pm.mu.Lock()
		delete(pm.ports, port)
		pm.mu.Unlock()
		return 0, "", fmt.Errorf("vite failed to start: %w", err)
	}

	pm.mu.Lock()
	pm.procs[siteID] = &previewProc{cmd: cmd, port: port, url: url}
	pm.ports[port] = siteID
	pm.mu.Unlock()
	return port, url, nil
}

func ensureDeps(ctx context.Context, sitePath string) error {
	if _, err := os.Stat(filepath.Join(sitePath, "node_modules")); err == nil {
		return nil
	}
	pkg := detectPackageManager(sitePath)
	var cmd *exec.Cmd
	switch pkg {
	case "bun":
		cmd = exec.CommandContext(ctx, "bun", "install")
	case "pnpm":
		cmd = exec.CommandContext(ctx, "pnpm", "install")
	case "yarn":
		cmd = exec.CommandContext(ctx, "yarn", "install")
	default:
		cmd = exec.CommandContext(ctx, "npm", "install", "--no-fund", "--no-audit")
	}
	cmd.Dir = sitePath
	cmd.Env = append(os.Environ(), "CI=1")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s install failed: %w\n%s", pkg, err, truncate(string(out), 2000))
	}
	return nil
}

func detectPackageManager(sitePath string) string {
	switch {
	case fileExists(filepath.Join(sitePath, "bun.lockb")), fileExists(filepath.Join(sitePath, "bun.lock")):
		return "bun"
	case fileExists(filepath.Join(sitePath, "pnpm-lock.yaml")):
		return "pnpm"
	case fileExists(filepath.Join(sitePath, "yarn.lock")):
		return "yarn"
	default:
		return "npm"
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func startVite(ctx context.Context, sitePath string, port int) (*exec.Cmd, error) {
	portStr := fmt.Sprintf("%d", port)
	var cmd *exec.Cmd
	switch detectPackageManager(sitePath) {
	case "bun":
		cmd = exec.CommandContext(ctx, "bun", "x", "vite", "--host", "127.0.0.1", "--port", portStr, "--strictPort")
	case "pnpm":
		cmd = exec.CommandContext(ctx, "pnpm", "exec", "vite", "--host", "127.0.0.1", "--port", portStr, "--strictPort")
	case "yarn":
		cmd = exec.CommandContext(ctx, "yarn", "vite", "--host", "127.0.0.1", "--port", portStr, "--strictPort")
	default:
		cmd = exec.CommandContext(ctx, "npx", "--yes", "vite", "--host", "127.0.0.1", "--port", portStr, "--strictPort")
	}
	cmd.Dir = sitePath
	cmd.Env = append(os.Environ(), "BROWSER=none")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	cmd.Stderr = cmd.Stdout
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	// Drain logs so the pipe does not block.
	go func() {
		sc := bufio.NewScanner(stdout)
		for sc.Scan() {
			_ = sc.Text()
		}
	}()
	return cmd, nil
}

func waitForPort(ctx context.Context, port int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting for %s", addr)
		}
		time.Sleep(150 * time.Millisecond)
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
