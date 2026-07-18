package mcp

import (
	"context"
	"net/url"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerSitesTools(server *sdkmcp.Server, c *client) {
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "sites_list",
		Description: "List all sites in the workspace (id, name, slug, template, path, status, preview). Call before claiming a site already exists. Pass workspace_id from <grose_modules>.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in workspaceInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/sites", c.ws(in))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type sitesCreateInput struct {
		workspaceInput
		Name      string `json:"name" jsonschema:"Site display name"`
		Template  string `json:"template,omitempty" jsonschema:"blank | landing | website (default blank)"`
		SessionID string `json:"sessionId,omitempty" jsonschema:"Optional session to bind"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "sites_create",
		Description: "Create a site by scaffolding an embedded Vite+React+TS+Tailwind template under modules/sites/{slug}.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in sitesCreateInput) (*sdkmcp.CallToolResult, any, error) {
		body := map[string]any{"name": in.Name}
		if in.Template != "" {
			body["template"] = in.Template
		}
		if in.SessionID != "" {
			body["sessionId"] = in.SessionID
		}
		res, err := c.post(ctx, "/api/sites", c.ws(in.workspaceInput), body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type siteIDInput struct {
		workspaceInput
		SiteID string `json:"site_id" jsonschema:"Site ID"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "sites_list_files",
		Description: "List the file tree for a site (skips node_modules/dist).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in siteIDInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/sites/"+url.PathEscape(in.SiteID)+"/files", c.ws(in.workspaceInput))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type sitesReadFileInput struct {
		workspaceInput
		SiteID string `json:"site_id" jsonschema:"Site ID"`
		Path   string `json:"path" jsonschema:"Relative file path inside the site root"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "sites_read_file",
		Description: "Read a text file from a site project (path relative to site root).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in sitesReadFileInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/sites/"+url.PathEscape(in.SiteID)+"/files/content?path="+url.QueryEscape(in.Path), c.ws(in.workspaceInput))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type sitesWriteFileInput struct {
		workspaceInput
		SiteID  string `json:"site_id" jsonschema:"Site ID"`
		Path    string `json:"path" jsonschema:"Relative file path inside the site root"`
		Content string `json:"content" jsonschema:"Full file contents to write"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "sites_write_file",
		Description: "Write/overwrite a text file in a site project (creates parent dirs as needed).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in sitesWriteFileInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.put(ctx, "/api/sites/"+url.PathEscape(in.SiteID)+"/files/content", c.ws(in.workspaceInput), map[string]any{
			"path": in.Path, "content": in.Content,
		})
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "sites_preview_start",
		Description: "Start (or reuse) the Vite preview server for a site on ports 5400+; returns previewUrl/previewPort/status.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in siteIDInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.post(ctx, "/api/sites/"+url.PathEscape(in.SiteID)+"/preview/start", c.ws(in.workspaceInput), map[string]any{})
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type sitesRunInput struct {
		workspaceInput
		SiteID  string   `json:"site_id" jsonschema:"Site ID"`
		Command string   `json:"command" jsonschema:"Allowed: npm, npx, bun, pnpm, yarn, node"`
		Args    []string `json:"args" jsonschema:"Command args, e.g. [\"install\"] or [\"run\",\"build\"]"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "sites_run_command",
		Description: "Run a restricted package-manager/node command inside the site directory (no shell metacharacters).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in sitesRunInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.post(ctx, "/api/sites/"+url.PathEscape(in.SiteID)+"/run", c.ws(in.workspaceInput), map[string]any{
			"command": in.Command, "args": in.Args,
		})
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})
}
