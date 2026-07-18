// Package workspace resolves Grose workspace id → absolute disk rootPath.
// Persistence must never assume basename(rootPath) === workspaceId.
package workspace

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const headerRoot = "X-Grose-Workspace-Root"

// HeaderRoot is the HTTP header Electron/TS may set with an absolute rootPath.
const HeaderRoot = headerRoot

type registryWorkspace struct {
	ID       string `json:"id"`
	RootPath string `json:"rootPath"`
}

type registryConfig struct {
	Workspaces []registryWorkspace `json:"workspaces"`
}

var (
	cacheMu   sync.Mutex
	cacheAt   time.Time
	cacheMap  map[string]string
	cacheTTL  = 2 * time.Second
)

// ConfigPath returns the global Grose config.json path (registry of workspaces).
func ConfigPath() string {
	if p := strings.TrimSpace(os.Getenv("GROSE_CONFIG_PATH")); p != "" {
		return p
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".grose-agent", "config.json")
}

// ResolveRoot returns the absolute workspace root for persistence.
// Prefer headerRoot (absolute) when set; otherwise look up workspaceID in the
// global registry (config.json). Never uses workspacesRoot/{id} as the primary path.
func ResolveRoot(workspaceID, headerRootPath string) (string, error) {
	ws := strings.TrimSpace(workspaceID)
	if ws == "" {
		return "", fmt.Errorf("workspace id required")
	}

	if root := strings.TrimSpace(headerRootPath); root != "" {
		if !filepath.IsAbs(root) {
			return "", fmt.Errorf("%s must be an absolute path", HeaderRoot)
		}
		return filepath.Clean(root), nil
	}

	root, err := lookupRegistry(ws)
	if err != nil {
		return "", err
	}
	if root == "" {
		return "", fmt.Errorf("workspace %q not found in registry (pass %s or ensure config.json lists rootPath)", ws, HeaderRoot)
	}
	return root, nil
}

// ModulePath joins rootPath/modules/{module}/…segments.
func ModulePath(rootPath, module string, segments ...string) string {
	parts := append([]string{rootPath, "modules", module}, segments...)
	return filepath.Join(parts...)
}

func lookupRegistry(workspaceID string) (string, error) {
	cacheMu.Lock()
	defer cacheMu.Unlock()

	if cacheMap != nil && time.Since(cacheAt) < cacheTTL {
		if root, ok := cacheMap[workspaceID]; ok {
			return root, nil
		}
		// Miss while cache fresh — still reload in case of brand-new workspace
	}

	path := ConfigPath()
	if path == "" {
		return "", fmt.Errorf("cannot resolve home for Grose config")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("workspace registry not found at %s", path)
		}
		return "", err
	}
	var cfg registryConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", fmt.Errorf("parse workspace registry: %w", err)
	}
	next := make(map[string]string, len(cfg.Workspaces))
	for _, w := range cfg.Workspaces {
		id := strings.TrimSpace(w.ID)
		root := strings.TrimSpace(w.RootPath)
		if id == "" || root == "" {
			continue
		}
		if strings.HasPrefix(root, "~/") {
			if home, err := os.UserHomeDir(); err == nil {
				root = filepath.Join(home, root[2:])
			}
		}
		if !filepath.IsAbs(root) {
			continue
		}
		next[id] = filepath.Clean(root)
	}
	cacheMap = next
	cacheAt = time.Now()
	return next[workspaceID], nil
}

// ResetCacheForTest clears the registry cache (tests only).
func ResetCacheForTest() {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	cacheMap = nil
	cacheAt = time.Time{}
}
