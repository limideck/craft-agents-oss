package sites

// Wire types match packages/shared craft-modules Sites client (camelCase JSON).

type Template string

const (
	TemplateBlank   Template = "blank"
	TemplateLanding Template = "landing"
	TemplateWebsite Template = "website"
)

type Status string

const (
	StatusIdle       Status = "idle"
	StatusInstalling Status = "installing"
	StatusReady      Status = "ready"
	StatusPreviewing Status = "previewing"
	StatusError      Status = "error"
)

type Site struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Template    Template `json:"template"`
	Path        string   `json:"path"` // absolute project directory
	PreviewPort *int     `json:"previewPort"`
	PreviewURL  *string  `json:"previewUrl"`
	Status      Status   `json:"status"`
	SessionID   *string  `json:"sessionId"`
	CreatedAt   int64    `json:"createdAt"` // unix ms
	UpdatedAt   int64    `json:"updatedAt"` // unix ms
}

type FileNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"` // relative to site root
	Type     string     `json:"type"` // file | directory
	Children []FileNode `json:"children,omitempty"`
}

type CreateInput struct {
	Name      string   `json:"name"`
	Template  Template `json:"template,omitempty"`
	SessionID *string  `json:"sessionId,omitempty"`
}

type UpdateInput struct {
	Name      *string `json:"name"`
	SessionID *string `json:"sessionId"`
}

type PreviewResult struct {
	PreviewURL  *string `json:"previewUrl"`
	PreviewPort *int    `json:"previewPort"`
	Status      Status  `json:"status"`
}

type VisualEdit struct {
	Type     string  `json:"type"` // text | style
	Selector *string `json:"selector,omitempty"`
	Line     *int    `json:"line,omitempty"`
	Column   *int    `json:"column,omitempty"`
	OldValue *string `json:"oldValue,omitempty"`
	NewValue string  `json:"newValue"`
	Property *string `json:"property,omitempty"`
}

type VisualEditSaveInput struct {
	SiteID   string       `json:"siteId"`
	FilePath string       `json:"filePath"`
	Edits    []VisualEdit `json:"edits"`
}

type RunCommandInput struct {
	Command string   `json:"command"`
	Args    []string `json:"args,omitempty"`
}

type RunCommandResult struct {
	OK       bool   `json:"ok"`
	ExitCode int    `json:"exitCode"`
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
}
