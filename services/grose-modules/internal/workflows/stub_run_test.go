package workflows_test

import (
	"testing"

	"github.com/grose-agent/grose-modules/internal/workflows"
)

func TestSynthesizeRunSteps(t *testing.T) {
	wf := workflows.Workflow{
		ID:   "wf-1",
		Name: "Demo",
		Nodes: []workflows.Node{
			{ID: "n-start", Type: "start", Name: "Start", Position: workflows.Position{X: 0, Y: 0}, Config: map[string]any{}},
			{ID: "n-agent", Type: "agent", Name: "Agent", Position: workflows.Position{X: 100, Y: 0}, Config: map[string]any{"agent": "helper"}},
		},
		Edges: []workflows.Edge{
			{ID: "e1", Source: "n-start", Target: "n-agent"},
		},
	}
	steps := workflows.SynthesizeRunSteps(wf, "run-abc")
	if len(steps) != 2 {
		t.Fatalf("steps=%d want 2", len(steps))
	}
	if steps[0].NodeID != "n-start" || steps[1].NodeID != "n-agent" {
		t.Fatalf("order=%v %v", steps[0].NodeID, steps[1].NodeID)
	}
	if steps[0].Status != "success" || steps[0].Input == nil || steps[0].Output == nil {
		t.Fatalf("step0=%+v", steps[0])
	}
	if steps[1].NodeType != "agent" || steps[1].DurationMs <= 0 {
		t.Fatalf("step1=%+v", steps[1])
	}
}

func TestSynthesizeRunStepsPhase25Types(t *testing.T) {
	wf := workflows.Workflow{
		ID:   "wf-2",
		Name: "Phase25",
		Nodes: []workflows.Node{
			{ID: "n-start", Type: "start", Name: "Start", Position: workflows.Position{X: 0, Y: 0}, Config: map[string]any{}},
			{ID: "n-clf", Type: "question-classifier", Name: "Classify", Position: workflows.Position{X: 100, Y: 0},
				Config: map[string]any{"categories": []any{map[string]any{"id": "billing", "label": "Billing"}}}},
			{ID: "n-switch", Type: "switch", Name: "Switch", Position: workflows.Position{X: 200, Y: 0},
				Config: map[string]any{"expression": "payload.x", "cases": []any{}}},
			{ID: "n-approve", Type: "human-approval", Name: "Approve", Position: workflows.Position{X: 300, Y: 0},
				Config: map[string]any{"title": "OK?"}},
			{ID: "n-sub", Type: "subworkflow", Name: "Sub", Position: workflows.Position{X: 400, Y: 0},
				Config: map[string]any{"workflowId": "wf-other"}},
		},
		Edges: []workflows.Edge{
			{ID: "e1", Source: "n-start", Target: "n-clf"},
			{ID: "e2", Source: "n-clf", Target: "n-switch"},
			{ID: "e3", Source: "n-switch", Target: "n-approve"},
			{ID: "e4", Source: "n-approve", Target: "n-sub"},
		},
	}
	steps := workflows.SynthesizeRunSteps(wf, "run-p25")
	if len(steps) != 5 {
		t.Fatalf("steps=%d want 5", len(steps))
	}
	wantTypes := []string{"start", "question-classifier", "switch", "human-approval", "subworkflow"}
	for i, want := range wantTypes {
		if steps[i].NodeType != want {
			t.Fatalf("step[%d].NodeType=%q want %q", i, steps[i].NodeType, want)
		}
		if steps[i].Output == nil {
			t.Fatalf("step[%d] missing output", i)
		}
	}
}
