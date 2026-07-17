package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/craft-agent/craft-modules/internal/config"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

type Deps struct {
	Port             int
	Token            string
	DefaultWorkspace string
}

func Handler(deps Deps) http.Handler {
	server := NewServer(deps)
	return sdkmcp.NewStreamableHTTPHandler(func(*http.Request) *sdkmcp.Server {
		return server
	}, nil)
}

func NewServer(deps Deps) *sdkmcp.Server {
	c := newClient(deps)
	server := sdkmcp.NewServer(&sdkmcp.Implementation{Name: "craft-modules", Version: config.Version}, nil)
	registerTools(server, c, deps.DefaultWorkspace)
	return server
}

func textResult(v any) (*sdkmcp.CallToolResult, any, error) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return nil, nil, err
	}
	return &sdkmcp.CallToolResult{Content: []sdkmcp.Content{&sdkmcp.TextContent{Text: string(b)}}}, nil, nil
}

type client struct {
	baseURL          string
	token            string
	defaultWorkspace string
	http             *http.Client
}

func newClient(deps Deps) *client {
	return &client{
		baseURL:          fmt.Sprintf("http://127.0.0.1:%d", deps.Port),
		token:            deps.Token,
		defaultWorkspace: deps.DefaultWorkspace,
		http:             http.DefaultClient,
	}
}

type workspaceInput struct {
	WorkspaceID string `json:"workspace_id,omitempty" jsonschema:"Craft workspace id from <craft_modules> workspace_id (matches Workbench UI). Prefer omitting to use CRAFT_DEFAULT_WORKSPACE_ID."`
}

func (c *client) ws(in workspaceInput) string {
	if in.WorkspaceID != "" {
		return in.WorkspaceID
	}
	return c.defaultWorkspace
}

func (c *client) request(ctx context.Context, method, path, workspaceID string, body any) (any, error) {
	if workspaceID == "" {
		return nil, fmt.Errorf("workspace_id required (tool arg or CRAFT_DEFAULT_WORKSPACE_ID)")
	}
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Craft-Workspace-Id", workspaceID)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		if len(data) > 0 {
			return nil, fmt.Errorf("HTTP %d %s %s: %s", res.StatusCode, method, path, string(data))
		}
		return nil, fmt.Errorf("HTTP %d %s %s", res.StatusCode, method, path)
	}
	if len(data) == 0 {
		return nil, nil
	}
	var out any
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *client) get(ctx context.Context, path, workspaceID string) (any, error) {
	return c.request(ctx, http.MethodGet, path, workspaceID, nil)
}

// getRaw returns the response body as a string (for XML/text endpoints).
func (c *client) getRaw(ctx context.Context, path, workspaceID string) (string, error) {
	if workspaceID == "" {
		return "", fmt.Errorf("workspace_id required (tool arg or CRAFT_DEFAULT_WORKSPACE_ID)")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-Craft-Workspace-Id", workspaceID)
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		if len(data) > 0 {
			return "", fmt.Errorf("HTTP %d GET %s: %s", res.StatusCode, path, string(data))
		}
		return "", fmt.Errorf("HTTP %d GET %s", res.StatusCode, path)
	}
	return string(data), nil
}

func (c *client) post(ctx context.Context, path, workspaceID string, body any) (any, error) {
	if body == nil {
		body = map[string]any{}
	}
	return c.request(ctx, http.MethodPost, path, workspaceID, body)
}

func (c *client) put(ctx context.Context, path, workspaceID string, body any) (any, error) {
	if body == nil {
		body = map[string]any{}
	}
	return c.request(ctx, http.MethodPut, path, workspaceID, body)
}

func (c *client) patch(ctx context.Context, path, workspaceID string, body any) (any, error) {
	return c.request(ctx, http.MethodPatch, path, workspaceID, body)
}

func (c *client) delete(ctx context.Context, path, workspaceID string) (any, error) {
	return c.request(ctx, http.MethodDelete, path, workspaceID, nil)
}
