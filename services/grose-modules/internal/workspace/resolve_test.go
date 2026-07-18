package workspace_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/grose-agent/grose-modules/internal/workspace"
)

func TestResolveRootPrefersHeader(t *testing.T) {
	workspace.ResetCacheForTest()
	root := t.TempDir()
	got, err := workspace.ResolveRoot("any-id", root)
	if err != nil {
		t.Fatal(err)
	}
	if got != root {
		t.Fatalf("got %q want %q", got, root)
	}
}

func TestResolveRootRejectsRelativeHeader(t *testing.T) {
	workspace.ResetCacheForTest()
	_, err := workspace.ResolveRoot("ws", "relative/path")
	if err == nil {
		t.Fatal("expected error for relative header root")
	}
}

func TestResolveRootFromRegistry(t *testing.T) {
	workspace.ResetCacheForTest()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("GROSE_CONFIG_PATH", "")

	wsRoot := filepath.Join(home, "my-slug-workspace")
	if err := os.MkdirAll(wsRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	cfgDir := filepath.Join(home, ".grose-agent")
	if err := os.MkdirAll(cfgDir, 0o755); err != nil {
		t.Fatal(err)
	}
	cfg := map[string]any{
		"workspaces": []map[string]string{
			{"id": "uuid-1", "rootPath": wsRoot},
		},
	}
	raw, _ := json.Marshal(cfg)
	if err := os.WriteFile(filepath.Join(cfgDir, "config.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}

	got, err := workspace.ResolveRoot("uuid-1", "")
	if err != nil {
		t.Fatal(err)
	}
	if got != wsRoot {
		t.Fatalf("got %q want %q", got, wsRoot)
	}

	_, err = workspace.ResolveRoot("missing", "")
	if err == nil {
		t.Fatal("expected missing workspace error")
	}
}

func TestModulePath(t *testing.T) {
	got := workspace.ModulePath("/ws/root", "rss", "rss.db")
	want := filepath.Join("/ws/root", "modules", "rss", "rss.db")
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestDBPathUsesRootNotId(t *testing.T) {
	// Imported via db package in db_test; smoke check ModulePath contract here.
	root := "/Users/me/.grose-agent/workspaces/acme-slug"
	id := "9ab64bb1-5cd9-61c6-b79a-00ae1cda2b1d"
	path := workspace.ModulePath(root, "rss", "rss.db")
	if filepath.Base(filepath.Dir(filepath.Dir(path))) == id {
		t.Fatal("path must not key off workspace id folder")
	}
	if path != filepath.Join(root, "modules", "rss", "rss.db") {
		t.Fatalf("unexpected path %q", path)
	}
}
