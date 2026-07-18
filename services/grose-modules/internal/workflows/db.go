package workflows

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	grosedb "github.com/grose-agent/grose-modules/internal/db"
	"github.com/grose-agent/grose-modules/internal/workspace"
)

// Manager opens per-workspace workflows SQLite DBs.
// Path: {rootPath}/modules/workflows/workflows.db
type Manager struct {
	mu     sync.Mutex
	opened map[string]*grosedb.DB
}

func NewManager() *Manager {
	return &Manager{opened: map[string]*grosedb.DB{}}
}

func DBPath(rootPath string) string {
	return workspace.ModulePath(rootPath, "workflows", "workflows.db")
}

func (m *Manager) Get(workspaceID, rootPath string) (*grosedb.DB, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	if workspaceID == "" {
		return nil, fmt.Errorf("workspace id required")
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if handle, ok := m.opened[workspaceID]; ok {
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
	// Preferred file SoT for graph defs (optional); DB remains SoT for now.
	_ = os.MkdirAll(workspace.ModulePath(rootPath, "workflows", "definitions"), 0o755)

	handle, err := grosedb.OpenHandle(path)
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
	return grosedb.WithBusyRetry(func() error {
		if _, err := sqldb.Exec(`
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  deployed_definition_json TEXT,
  deployed_at TEXT,
  deployed_version INTEGER NOT NULL DEFAULT 0,
  triggers_armed_json TEXT
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
		if err := migrateWorkflowColumns(sqldb); err != nil {
			return err
		}
		return nil
	})
}

// migrateWorkflowColumns adds deploy columns to DBs created before deploy existed.
func migrateWorkflowColumns(sqldb *sql.DB) error {
	cols, err := tableColumns(sqldb, "workflows")
	if err != nil {
		return err
	}
	additions := []struct {
		name string
		ddl  string
	}{
		{"status", `ALTER TABLE workflows ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`},
		{"deployed_definition_json", `ALTER TABLE workflows ADD COLUMN deployed_definition_json TEXT`},
		{"deployed_at", `ALTER TABLE workflows ADD COLUMN deployed_at TEXT`},
		{"deployed_version", `ALTER TABLE workflows ADD COLUMN deployed_version INTEGER NOT NULL DEFAULT 0`},
		{"triggers_armed_json", `ALTER TABLE workflows ADD COLUMN triggers_armed_json TEXT`},
	}
	for _, a := range additions {
		if cols[a.name] {
			continue
		}
		if _, err := sqldb.Exec(a.ddl); err != nil {
			return fmt.Errorf("workflows migrate %s: %w", a.name, err)
		}
	}
	return nil
}

func tableColumns(sqldb *sql.DB, table string) (map[string]bool, error) {
	rows, err := sqldb.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return nil, err
		}
		out[name] = true
	}
	return out, rows.Err()
}
