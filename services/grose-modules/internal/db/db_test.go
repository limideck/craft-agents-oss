package db_test

import (
	"path/filepath"
	"testing"

	"github.com/grose-agent/grose-modules/internal/db"
	_ "modernc.org/sqlite"
)

func TestOpenAppliesWALAndBusyTimeout(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "rss.db")
	handle, err := db.OpenHandle(path)
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()

	var mode string
	if err := handle.Writer().QueryRow(`PRAGMA journal_mode`).Scan(&mode); err != nil {
		t.Fatal(err)
	}
	if mode != "wal" {
		t.Fatalf("journal_mode=%q want wal", mode)
	}
	var timeout int
	if err := handle.Writer().QueryRow(`PRAGMA busy_timeout`).Scan(&timeout); err != nil {
		t.Fatal(err)
	}
	if timeout < 1000 {
		t.Fatalf("busy_timeout=%d want >=1000", timeout)
	}
}
