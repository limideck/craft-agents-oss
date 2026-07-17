package sites

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	craftdb "github.com/craft-agent/craft-modules/internal/db"
	"github.com/craft-agent/craft-modules/internal/workspace"
)

// Manager opens per-workspace sites SQLite DBs.
// Path: {rootPath}/modules/sites/sites.db
type Manager struct {
	mu     sync.Mutex
	opened map[string]*craftdb.DB
	roots  map[string]string // workspaceID → absolute rootPath
}

func NewManager() *Manager {
	return &Manager{
		opened: map[string]*craftdb.DB{},
		roots:  map[string]string{},
	}
}

func DBPath(rootPath string) string {
	return workspace.ModulePath(rootPath, "sites", "sites.db")
}

func SitesDir(rootPath string) string {
	return workspace.ModulePath(rootPath, "sites")
}

func (m *Manager) Get(workspaceID, rootPath string) (*craftdb.DB, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	if workspaceID == "" {
		return nil, fmt.Errorf("workspace id required")
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if handle, ok := m.opened[workspaceID]; ok {
		if rootPath != "" {
			m.roots[workspaceID] = filepath.Clean(rootPath)
		}
		return handle, nil
	}
	rootPath = filepath.Clean(strings.TrimSpace(rootPath))
	if rootPath == "" || !filepath.IsAbs(rootPath) {
		return nil, fmt.Errorf("absolute workspace rootPath required")
	}
	path := DBPath(rootPath)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	handle, err := craftdb.OpenHandle(path)
	if err != nil {
		return nil, err
	}
	if err := InitSchema(handle.Writer()); err != nil {
		handle.Close()
		return nil, err
	}
	m.opened[workspaceID] = handle
	m.roots[workspaceID] = rootPath
	return handle, nil
}

// RootPath returns the cached absolute workspace root for an open workspace.
func (m *Manager) RootPath(workspaceID string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.roots[strings.TrimSpace(workspaceID)]
}

func InitSchema(sqldb *sql.DB) error {
	return craftdb.WithBusyRetry(func() error {
		_, err := sqldb.Exec(`
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL,
  path TEXT NOT NULL,
  preview_port INTEGER,
  preview_url TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites (slug);
CREATE INDEX IF NOT EXISTS idx_sites_updated ON sites (updated_at DESC);
`)
		if err != nil {
			return fmt.Errorf("sites schema: %w", err)
		}
		return nil
	})
}
