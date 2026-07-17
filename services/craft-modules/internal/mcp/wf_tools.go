package mcp

import (
	"context"
	"net/url"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerWorkflowTools(server *sdkmcp.Server, c *client) {
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "wf_list",
		Description: "List all workflows in the workspace (id, name, nodes, edges, updatedAt).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in workspaceInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/workflows", c.ws(in))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type wfIDInput struct {
		workspaceInput
		ID string `json:"id" jsonschema:"Workflow ID"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "wf_get",
		Description: "Get one workflow by id.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in wfIDInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/workflows/"+url.PathEscape(in.ID), c.ws(in.workspaceInput))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type wfCreateInput struct {
		workspaceInput
		Name        string `json:"name" jsonschema:"Workflow display name"`
		Description string `json:"description,omitempty" jsonschema:"Optional description"`
		Nodes       any    `json:"nodes,omitempty" jsonschema:"Optional nodes array"`
		Edges       any    `json:"edges,omitempty" jsonschema:"Optional edges array"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "wf_create",
		Description: "Create a workflow. Body: name + optional description, nodes, edges.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in wfCreateInput) (*sdkmcp.CallToolResult, any, error) {
		body := map[string]any{"name": in.Name}
		if in.Description != "" {
			body["description"] = in.Description
		}
		if in.Nodes != nil {
			body["nodes"] = in.Nodes
		}
		if in.Edges != nil {
			body["edges"] = in.Edges
		}
		res, err := c.post(ctx, "/api/workflows", c.ws(in.workspaceInput), body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type wfUpdateInput struct {
		workspaceInput
		ID          string `json:"id" jsonschema:"Workflow ID"`
		Name        string `json:"name,omitempty" jsonschema:"New name"`
		Description string `json:"description,omitempty" jsonschema:"New description"`
		Nodes       any    `json:"nodes,omitempty" jsonschema:"Replace nodes array"`
		Edges       any    `json:"edges,omitempty" jsonschema:"Replace edges array"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "wf_update",
		Description: "Patch a workflow by id (name, description, nodes, and/or edges).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in wfUpdateInput) (*sdkmcp.CallToolResult, any, error) {
		body := map[string]any{}
		// MCP JSON decode leaves omitted strings as ""; only send fields that were meaningfully set.
		// Prefer sending whatever the caller provided when non-empty, plus always send nodes/edges when present.
		if in.Name != "" {
			body["name"] = in.Name
		}
		if in.Description != "" {
			body["description"] = in.Description
		}
		if in.Nodes != nil {
			body["nodes"] = in.Nodes
		}
		if in.Edges != nil {
			body["edges"] = in.Edges
		}
		res, err := c.patch(ctx, "/api/workflows/"+url.PathEscape(in.ID), c.ws(in.workspaceInput), body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "wf_delete",
		Description: "Delete a workflow by id.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in wfIDInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.delete(ctx, "/api/workflows/"+url.PathEscape(in.ID), c.ws(in.workspaceInput))
		if err != nil {
			return nil, nil, err
		}
		if res == nil {
			return textResult(map[string]any{"ok": true})
		}
		return textResult(res)
	})

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "wf_run",
		Description: "Enqueue a workflow run (stub — accepted only; no graph execution yet).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in wfIDInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.post(ctx, "/api/workflows/"+url.PathEscape(in.ID)+"/run", c.ws(in.workspaceInput), map[string]any{})
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})
}
