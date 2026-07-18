package sites

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

var allowedCommands = map[string]bool{
	"npm":  true,
	"npx":  true,
	"bun":  true,
	"bunx": true,
	"vite": true,
	"pnpm": true,
	"yarn": true,
	"node": true,
}

var blockedArgTokens = []string{
	";", "&&", "||", "|", "`", "$(", "${", ">", "<", "\n", "\r",
}

// RunCommand executes a restricted package-manager / node command inside the site root.
func RunCommand(ctx context.Context, siteRoot string, in RunCommandInput) (RunCommandResult, error) {
	cmdName := strings.TrimSpace(in.Command)
	if cmdName == "" {
		return RunCommandResult{}, fmt.Errorf("command required")
	}
	base := filepath.Base(cmdName)
	if base != cmdName || strings.Contains(cmdName, "/") || strings.Contains(cmdName, `\`) {
		return RunCommandResult{}, fmt.Errorf("command must be a bare executable name")
	}
	if !allowedCommands[base] {
		return RunCommandResult{}, fmt.Errorf("command %q not allowed (allowed: npm, npx, bun, bunx, vite, pnpm, yarn, node)", base)
	}
	args := in.Args
	if args == nil {
		args = []string{}
	}
	for _, a := range args {
		if err := validateArg(a); err != nil {
			return RunCommandResult{}, err
		}
	}
	if err := validateAllowedInvocation(base, args); err != nil {
		return RunCommandResult{}, err
	}

	if ctx == nil {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
	}

	cmd := exec.CommandContext(ctx, base, args...)
	cmd.Dir = siteRoot
	cmd.Env = append(os.Environ(), "CI=1", "BROWSER=none")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	res := RunCommandResult{
		Stdout: truncate(stdout.String(), 32_000),
		Stderr: truncate(stderr.String(), 32_000),
	}
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			res.ExitCode = ee.ExitCode()
			res.OK = false
			return res, nil
		}
		return res, err
	}
	res.OK = true
	res.ExitCode = 0
	return res, nil
}

func validateArg(a string) error {
	if strings.HasPrefix(a, "-") {
		// flags ok
		return nil
	}
	for _, bad := range blockedArgTokens {
		if strings.Contains(a, bad) {
			return fmt.Errorf("argument contains blocked token")
		}
	}
	// Reject path escape attempts
	if strings.Contains(a, "..") {
		return fmt.Errorf("argument path traversal not allowed")
	}
	return nil
}

func validateAllowedInvocation(cmd string, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("args required")
	}
	sub := args[0]
	switch cmd {
	case "npm", "pnpm", "yarn", "bun":
		switch sub {
		case "install", "ci", "add", "remove", "run", "exec", "x", "vite", "build", "test", "lint", "outdated", "ls", "list", "pack", "link":
			return nil
		default:
			// bun/npm script shorthand is rejected; require `run`
			return fmt.Errorf("subcommand %q not allowed for %s", sub, cmd)
		}
	case "npx", "bunx", "vite":
		return nil
	case "node":
		// only allow running local scripts (no -e eval)
		for _, a := range args {
			if a == "-e" || a == "--eval" || a == "-p" || a == "--print" {
				return fmt.Errorf("node eval flags not allowed")
			}
		}
		return nil
	default:
		return fmt.Errorf("command not allowed")
	}
}
