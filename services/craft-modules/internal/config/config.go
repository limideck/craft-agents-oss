package config

import (
	"flag"
	"os"
	"path/filepath"
	"strconv"
)

const Version = "0.1.0"

type Config struct {
	Port            int
	WorkspacesRoot  string
	Token           string
	LogDir          string
	DefaultWorkspace string
}

func Load() Config {
	port := flag.Int("port", envInt("PORT", 0), "listen port (127.0.0.1 only)")
	dbRoot := flag.String("db-root", os.Getenv("CRAFT_MODULES_DB_ROOT"), "legacy parent of per-workspace module dirs")
	logDir := flag.String("log-dir", os.Getenv("CRAFT_MODULES_LOG_DIR"), "optional log directory")
	token := flag.String("token", os.Getenv("CRAFT_MODULES_TOKEN"), "optional bearer token for /api and /mcp")
	flag.Parse()

	workspacesRoot := os.Getenv("CRAFT_WORKSPACES_ROOT")
	if workspacesRoot == "" && *dbRoot != "" {
		workspacesRoot = *dbRoot
	}
	if workspacesRoot == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			workspacesRoot = filepath.Join(home, ".craft-agent", "workspaces")
		}
	}

	return Config{
		Port:             *port,
		WorkspacesRoot:   workspacesRoot,
		Token:            *token,
		LogDir:           *logDir,
		DefaultWorkspace: os.Getenv("CRAFT_DEFAULT_WORKSPACE_ID"),
	}
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
