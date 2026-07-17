package workflows

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	craftdb "github.com/craft-agent/craft-modules/internal/db"
)

// Manager opens per-workspace workflows SQLite DBs.
// Path: {root}/{workspaceID}/modules/workflows/workflows.db
type Manager struct {
	root   string
	mu     sync.Mutex
	opened map[string]*craftdb.DB
}

func NewManager(root string) *Manager {
	return &Manager{root: root, opened: map[string]*craftdb.DB{}}
}

func (m *Manager) DBPath(workspaceID string) string {
	return filepath.Join(m.root, workspaceID, "modules", "workflows", "workflows.db")
}

func (m *Manager) Get(workspaceID string) (*craftdb.DB, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if handle, ok := m.opened[workspaceID]; ok {
		return handle, nil
	}
	path := m.DBPath(workspaceID)
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
	return handle, nil
}

func InitSchema(sqldb *sql.DB) error {
	return craftdb.WithBusyRetry(func() error {
		if _, err := sqldb.Exec(`
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs (workflow_id);
`); err != nil {
			return fmt.Errorf("workflows schema: %w", err)
		}
		return nil
	})
}
