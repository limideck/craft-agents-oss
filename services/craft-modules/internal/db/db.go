package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/craft-agent/craft-modules/internal/workspace"
)

type DB struct {
	read  *sql.DB
	write *sql.DB
	path  string
}

// Manager opens per-workspace RSS DBs under {rootPath}/modules/rss/rss.db.
// Callers must resolve workspace id → absolute rootPath first (registry / header).
type Manager struct {
	mu     sync.Mutex
	opened map[string]*DB
}

func NewManager() *Manager {
	return &Manager{opened: map[string]*DB{}}
}

// DBPath returns the RSS sqlite path for an absolute workspace root.
func DBPath(rootPath string) string {
	return workspace.ModulePath(rootPath, "rss", "rss.db")
}

// Get opens (or returns) the RSS DB for workspaceID at absolute rootPath.
// rootPath may be empty when the workspace is already open (e.g. poller).
func (m *Manager) Get(workspaceID, rootPath string) (*DB, error) {
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
	handle, err := OpenHandle(path)
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

func (m *Manager) ForEach(fn func(workspaceID string, db *DB) error) error {
	m.mu.Lock()
	ids := make([]string, 0, len(m.opened))
	for id := range m.opened {
		ids = append(ids, id)
	}
	handles := make([]*DB, len(ids))
	for i, id := range ids {
		handles[i] = m.opened[id]
	}
	m.mu.Unlock()

	var firstErr error
	for i, id := range ids {
		if err := fn(id, handles[i]); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func OpenHandle(path string) (*DB, error) {
	read, err := Open(path)
	if err != nil {
		return nil, err
	}
	write, err := Open(path)
	if err != nil {
		_ = read.Close()
		return nil, err
	}
	// One writer connection — SQLite allows only one writer at a time.
	write.SetMaxOpenConns(1)
	write.SetMaxIdleConns(1)
	write.SetConnMaxLifetime(0)
	// Bounded reader pool; WAL allows concurrent readers.
	read.SetMaxOpenConns(8)
	read.SetMaxIdleConns(4)
	read.SetConnMaxLifetime(0)
	return &DB{read: read, write: write, path: path}, nil
}

func (d *DB) Reader() *sql.DB { return d.read }
func (d *DB) Writer() *sql.DB { return d.write }
func (d *DB) Path() string    { return d.path }

func (d *DB) Close() error {
	we := d.write.Close()
	re := d.read.Close()
	if we != nil {
		return we
	}
	return re
}

// Open uses modernc.org/sqlite DSN pragma syntax (NOT mattn _busy_timeout=).
// Without _pragma=…, busy_timeout stays 0 and concurrent refresh returns SQLITE_BUSY immediately.
func Open(path string) (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"file:%s?_pragma=busy_timeout(%d)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)",
		path,
		30_000,
	)
	sqldb, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	if err := sqldb.Ping(); err != nil {
		_ = sqldb.Close()
		return nil, err
	}
	// Belt-and-suspenders: assert pragmas landed (DSN typos fail silently on some drivers).
	var mode string
	if err := sqldb.QueryRow(`PRAGMA journal_mode`).Scan(&mode); err != nil {
		_ = sqldb.Close()
		return nil, fmt.Errorf("pragma journal_mode: %w", err)
	}
	if strings.ToLower(mode) != "wal" {
		_ = sqldb.Close()
		return nil, fmt.Errorf("expected WAL journal_mode, got %q (check modernc DSN _pragma= syntax)", mode)
	}
	var timeout int
	if err := sqldb.QueryRow(`PRAGMA busy_timeout`).Scan(&timeout); err != nil {
		_ = sqldb.Close()
		return nil, fmt.Errorf("pragma busy_timeout: %w", err)
	}
	if timeout < 1000 {
		_ = sqldb.Close()
		return nil, fmt.Errorf("expected busy_timeout>=1000, got %d", timeout)
	}
	return sqldb, nil
}

func InitSchema(db *sql.DB) error {
	return WithBusyRetry(func() error {
		if _, err := db.Exec(`
CREATE TABLE IF NOT EXISTS feeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  last_fetched_at INTEGER
);
CREATE TABLE IF NOT EXISTS article_states (
  article_id TEXT PRIMARY KEY,
  feed_id TEXT,
  feed_name TEXT,
  feed_url TEXT,
  title TEXT,
  link TEXT,
  pub_date TEXT,
  pub_ts INTEGER,
  summary TEXT,
  content TEXT,
  author TEXT,
  audio_url TEXT DEFAULT '',
  audio_duration TEXT DEFAULT '',
  is_starred INTEGER DEFAULT 0,
  starred_at INTEGER,
  content_updated_at INTEGER,
  updated_at INTEGER DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`); err != nil {
			return fmt.Errorf("base schema: %w", err)
		}

		if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_article_states_feed_pub ON article_states (feed_id, pub_ts)`); err != nil {
			return err
		}
		if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_article_states_pub ON article_states (pub_ts)`); err != nil {
			return err
		}
		if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_article_states_starred ON article_states (starred_at DESC) WHERE is_starred = 1`); err != nil {
			return err
		}
		if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_article_states_podcast ON article_states (pub_date DESC) WHERE audio_url IS NOT NULL AND audio_url != ''`); err != nil {
			return err
		}
		if _, err := db.Exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('rsshub_base_url', 'http://localhost:1200')`); err != nil {
			return err
		}
		return nil
	})
}

func IsBusy(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "database is locked") ||
		strings.Contains(msg, "sqlite_busy") ||
		strings.Contains(msg, "busy")
}

func WithBusyRetry(fn func() error) error {
	var err error
	for attempt := 0; attempt < 8; attempt++ {
		err = fn()
		if err == nil || !IsBusy(err) {
			return err
		}
		time.Sleep(time.Duration(25*(1<<attempt)) * time.Millisecond)
	}
	return err
}
