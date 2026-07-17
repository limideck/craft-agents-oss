package workflows_test

import (
	"path/filepath"
	"testing"

	"github.com/craft-agent/craft-modules/internal/workflows"
	_ "modernc.org/sqlite"
)

func TestCRUDRoundTrip(t *testing.T) {
	dir := t.TempDir()
	mgr := workflows.NewManager(dir)
	handle, err := mgr.Get("ws-test")
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()

	wantPath := filepath.Join(dir, "ws-test", "modules", "workflows", "workflows.db")
	if handle.Path() != wantPath {
		t.Fatalf("path=%q want %q", handle.Path(), wantPath)
	}

	created, err := workflows.Create(handle.Writer(), workflows.CreateInput{
		Name:        "Onboarding digest",
		Description: "Daily summary",
		Nodes: []workflows.Node{
			{
				ID: "n-start", Type: "start", Name: "Start",
				Position: workflows.Position{X: 48, Y: 80},
				Config:   map[string]any{},
			},
			{
				ID: "n-agent", Type: "agent", Name: "Summarize",
				Position: workflows.Position{X: 400, Y: 80},
				Config:   map[string]any{"agent": "inbox-helper"},
			},
		},
		Edges: []workflows.Edge{
			{ID: "e1", Source: "n-start", Target: "n-agent"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || created.Name != "Onboarding digest" {
		t.Fatalf("created=%+v", created)
	}
	if len(created.Nodes) != 2 || len(created.Edges) != 1 {
		t.Fatalf("graph nodes=%d edges=%d", len(created.Nodes), len(created.Edges))
	}
	if created.UpdatedAt == "" {
		t.Fatal("updatedAt empty")
	}

	listed, err := workflows.List(handle.Reader())
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 {
		t.Fatalf("list len=%d", len(listed))
	}

	got, ok, err := workflows.Get(handle.Reader(), created.ID)
	if err != nil || !ok {
		t.Fatalf("get ok=%v err=%v", ok, err)
	}
	if got.Description != "Daily summary" {
		t.Fatalf("description=%q", got.Description)
	}

	newName := "Renamed"
	nodes := []workflows.Node{
		{ID: "n-start", Type: "start", Name: "Start", Position: workflows.Position{X: 0, Y: 0}, Config: map[string]any{}},
	}
	edges := []workflows.Edge{}
	updated, ok, err := workflows.Update(handle.Writer(), created.ID, workflows.UpdateInput{
		Name:  &newName,
		Nodes: &nodes,
		Edges: &edges,
	})
	if err != nil || !ok {
		t.Fatalf("update ok=%v err=%v", ok, err)
	}
	if updated.Name != "Renamed" || len(updated.Nodes) != 1 || len(updated.Edges) != 0 {
		t.Fatalf("updated=%+v", updated)
	}

	runID, err := workflows.InsertRunStub(handle.Writer(), created.ID)
	if err != nil || runID == "" {
		t.Fatalf("run stub runID=%q err=%v", runID, err)
	}

	ok, err = workflows.Delete(handle.Writer(), created.ID)
	if err != nil || !ok {
		t.Fatalf("delete ok=%v err=%v", ok, err)
	}
	_, ok, err = workflows.Get(handle.Reader(), created.ID)
	if err != nil || ok {
		t.Fatalf("after delete ok=%v err=%v", ok, err)
	}
}

func TestCreateRequiresName(t *testing.T) {
	dir := t.TempDir()
	mgr := workflows.NewManager(dir)
	handle, err := mgr.Get("ws")
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()

	_, err = workflows.Create(handle.Writer(), workflows.CreateInput{Name: "  "})
	if err == nil || err.Error() != "name required" {
		t.Fatalf("err=%v", err)
	}
}
