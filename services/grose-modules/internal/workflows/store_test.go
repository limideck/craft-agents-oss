package workflows_test

import (
	"path/filepath"
	"testing"

	"github.com/grose-agent/grose-modules/internal/workflows"
	_ "modernc.org/sqlite"
)

func TestCRUDRoundTrip(t *testing.T) {
	dir := t.TempDir()
	mgr := workflows.NewManager()
	handle, err := mgr.Get("ws-test", dir)
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()

	wantPath := filepath.Join(dir, "modules", "workflows", "workflows.db")
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
	if created.Status != workflows.StatusDraft || created.Version != 0 {
		t.Fatalf("expected draft v0, got status=%q version=%d", created.Status, created.Version)
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
	mgr := workflows.NewManager()
	handle, err := mgr.Get("ws", dir)
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()

	_, err = workflows.Create(handle.Writer(), workflows.CreateInput{Name: "  "})
	if err == nil || err.Error() != "name required" {
		t.Fatalf("err=%v", err)
	}
}

func TestDeployAndUndeploy(t *testing.T) {
	dir := t.TempDir()
	mgr := workflows.NewManager()
	handle, err := mgr.Get("ws-deploy", dir)
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()

	created, err := workflows.Create(handle.Writer(), workflows.CreateInput{
		Name: "Scheduled digests",
		Nodes: []workflows.Node{
			{
				ID: "n-sched", Type: "schedule", Name: "Daily",
				Position: workflows.Position{X: 0, Y: 0},
				Config:   map[string]any{"cron": "0 9 * * *", "timezone": "UTC"},
			},
			{
				ID: "n-hook", Type: "webhook", Name: "Hook",
				Position: workflows.Position{X: 200, Y: 0},
				Config:   map[string]any{"path": "/hooks/digest", "method": "POST"},
			},
			{
				ID: "n-agent", Type: "agent", Name: "Summarize",
				Position: workflows.Position{X: 400, Y: 0},
				Config:   map[string]any{"agent": "default"},
			},
		},
		Edges: []workflows.Edge{
			{ID: "e1", Source: "n-sched", Target: "n-agent"},
			{ID: "e2", Source: "n-hook", Target: "n-agent"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Status != workflows.StatusDraft || created.Version != 0 {
		t.Fatalf("fresh create status=%q version=%d", created.Status, created.Version)
	}

	dep, ok, err := workflows.Deploy(handle.Writer(), created.ID)
	if err != nil || !ok {
		t.Fatalf("deploy ok=%v err=%v", ok, err)
	}
	if dep.Status != workflows.StatusDeployed || dep.Version != 1 || dep.DeployedAt == "" {
		t.Fatalf("deploy result=%+v", dep)
	}
	if dep.TriggersArmed == nil || !dep.TriggersArmed.Armed || len(dep.TriggersArmed.Triggers) != 2 {
		t.Fatalf("triggersArmed=%+v", dep.TriggersArmed)
	}

	got, ok, err := workflows.Get(handle.Reader(), created.ID)
	if err != nil || !ok {
		t.Fatalf("get after deploy ok=%v err=%v", ok, err)
	}
	if got.Status != workflows.StatusDeployed || got.Version != 1 || got.DeployedAt == "" {
		t.Fatalf("get after deploy=%+v", got)
	}
	if got.TriggersArmed == nil || !got.TriggersArmed.Armed {
		t.Fatalf("get triggersArmed=%+v", got.TriggersArmed)
	}

	// Redeploy bumps version and re-snapshots.
	dep2, ok, err := workflows.Deploy(handle.Writer(), created.ID)
	if err != nil || !ok || dep2.Version != 2 {
		t.Fatalf("redeploy ok=%v version=%d err=%v", ok, dep2.Version, err)
	}

	und, ok, err := workflows.Undeploy(handle.Writer(), created.ID)
	if err != nil || !ok {
		t.Fatalf("undeploy ok=%v err=%v", ok, err)
	}
	if und.Status != workflows.StatusDraft || und.Version != 2 {
		t.Fatalf("undeploy result=%+v", und)
	}

	got2, ok, err := workflows.Get(handle.Reader(), created.ID)
	if err != nil || !ok {
		t.Fatalf("get after undeploy ok=%v err=%v", ok, err)
	}
	if got2.Status != workflows.StatusDraft || got2.Version != 2 {
		t.Fatalf("after undeploy=%+v", got2)
	}
	if got2.TriggersArmed != nil {
		t.Fatalf("triggersArmed should be cleared when draft: %+v", got2.TriggersArmed)
	}
}

func TestDeployNotFound(t *testing.T) {
	dir := t.TempDir()
	mgr := workflows.NewManager()
	handle, err := mgr.Get("ws", dir)
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()

	_, ok, err := workflows.Deploy(handle.Writer(), "missing")
	if err != nil || ok {
		t.Fatalf("ok=%v err=%v", ok, err)
	}
}

func TestCollectTriggersArmed(t *testing.T) {
	armed := workflows.CollectTriggersArmed([]workflows.Node{
		{ID: "a", Type: "start", Name: "Start", Config: map[string]any{}},
		{ID: "b", Type: "schedule", Name: "Cron", Config: map[string]any{"cron": "*/5 * * * *"}},
	})
	if !armed.Armed || len(armed.Triggers) != 1 || armed.Triggers[0].Cron != "*/5 * * * *" {
		t.Fatalf("%+v", armed)
	}
	empty := workflows.CollectTriggersArmed([]workflows.Node{
		{ID: "a", Type: "agent", Name: "A", Config: map[string]any{}},
	})
	if empty.Armed || len(empty.Triggers) != 0 {
		t.Fatalf("%+v", empty)
	}
}
