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

// WorkflowStatus is draft until Deploy publishes a live snapshot.
const (
	StatusDraft    = "draft"
	StatusDeployed = "deployed"
)

// ArmedTrigger records a schedule/webhook node present at deploy time.
// Runners are stub — this metadata only marks them as "armed" for future firing.
type ArmedTrigger struct {
	NodeID string `json:"nodeId"`
	Type   string `json:"type"` // schedule | webhook
	Name   string `json:"name,omitempty"`
	Cron   string `json:"cron,omitempty"`
	Path   string `json:"path,omitempty"`
	Method string `json:"method,omitempty"`
}

// TriggersArmed is persisted at deploy and returned on get/list when deployed.
type TriggersArmed struct {
	// Armed is true when the live graph has at least one schedule or webhook node.
	Armed bool `json:"armed"`
	// Note documents that schedule/webhook HTTP listeners are not live yet.
	Note     string         `json:"note,omitempty"`
	Triggers []ArmedTrigger `json:"triggers"`
}

type Workflow struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Nodes       []Node `json:"nodes"`
	Edges       []Edge `json:"edges"`
	UpdatedAt   string `json:"updatedAt"`

	// Deploy metadata (list/get).
	Status     string `json:"status"`               // draft | deployed
	Version    int    `json:"version"`              // deployed_version; 0 if never deployed
	DeployedAt string `json:"deployedAt,omitempty"` // ISO-8601; set when status is deployed (or last deploy)

	// Present when deployed and the live snapshot had schedule/webhook nodes.
	TriggersArmed *TriggersArmed `json:"triggersArmed,omitempty"`
}

// DeployResult is the body of POST .../deploy (and undeploy).
type DeployResult struct {
	ID            string         `json:"id"`
	Version       int            `json:"version"`
	DeployedAt    string         `json:"deployedAt,omitempty"`
	Status        string         `json:"status"`
	TriggersArmed *TriggersArmed `json:"triggersArmed,omitempty"`
}

// definitionPayload is the JSON blob stored in definition_json / deployed_definition_json.
type definitionPayload struct {
	Description string `json:"description,omitempty"`
	Nodes       []Node `json:"nodes"`
	Edges       []Edge `json:"edges"`
}
