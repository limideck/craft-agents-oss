package workflows

// Wire types match docs/workbench-workflows-contract.md.

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Node struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Name     string         `json:"name"`
	Position Position       `json:"position"`
	Config   map[string]any `json:"config"`
}

type Edge struct {
	ID           string  `json:"id"`
	Source       string  `json:"source"`
	Target       string  `json:"target"`
	SourceHandle *string `json:"sourceHandle,omitempty"`
	TargetHandle *string `json:"targetHandle,omitempty"`
}

type Workflow struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Nodes       []Node `json:"nodes"`
	Edges       []Edge `json:"edges"`
	UpdatedAt   string `json:"updatedAt"`
}

// definitionPayload is the JSON blob stored in definition_json.
type definitionPayload struct {
	Description string `json:"description,omitempty"`
	Nodes       []Node `json:"nodes"`
	Edges       []Edge `json:"edges"`
}
