package mcp

import (
	"context"
	"net/url"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerTools(server *sdkmcp.Server, c *client, _ string) {
	registerWorkflowTools(server, c)
	registerSitesTools(server, c)

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_list_feeds",
		Description: "List all subscribed RSS feeds with id, name, and URL. Call this before claiming feeds are already added. Use workspace_id from <grose_modules> (same as Workbench UI).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in workspaceInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/rss/feeds", c.ws(in))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type addFeedInput struct {
		workspaceInput
		URL  string `json:"url" jsonschema:"RSS feed URL"`
		Name string `json:"name,omitempty" jsonschema:"Display name; defaults to feed title"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_add_feed",
		Description: "Subscribe to a new RSS feed by URL. Pass workspace_id from <grose_modules> so the feed appears in the Workbench RSS UI.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in addFeedInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.post(ctx, "/api/rss/feeds", c.ws(in.workspaceInput), map[string]any{"url": in.URL, "name": in.Name})
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type renameFeedInput struct {
		workspaceInput
		ID   string `json:"id" jsonschema:"Feed ID"`
		Name string `json:"name" jsonschema:"New display name"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_rename_feed",
		Description: "Rename an existing feed.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in renameFeedInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.patch(ctx, "/api/rss/feeds/"+url.PathEscape(in.ID), c.ws(in.workspaceInput), map[string]any{"name": in.Name})
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type feedIDInput struct {
		workspaceInput
		ID string `json:"id" jsonschema:"Feed ID"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_delete_feed",
		Description: "Unsubscribe from a feed.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in feedIDInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.delete(ctx, "/api/rss/feeds/"+url.PathEscape(in.ID), c.ws(in.workspaceInput))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type importOPMLInput struct {
		workspaceInput
		OPML string `json:"opml" jsonschema:"OPML XML content"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_import_opml",
		Description: "Bulk-import feeds from OPML XML.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in importOPMLInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.post(ctx, "/api/rss/feeds/import-opml", c.ws(in.workspaceInput), map[string]any{"opml": in.OPML})
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_export_opml",
		Description: "Export all subscribed feeds as OPML XML.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in workspaceInput) (*sdkmcp.CallToolResult, any, error) {
		raw, err := c.getRaw(ctx, "/api/rss/feeds/export-opml", c.ws(in))
		if err != nil {
			return nil, nil, err
		}
		return &sdkmcp.CallToolResult{Content: []sdkmcp.Content{&sdkmcp.TextContent{Text: raw}}}, nil, nil
	})

	type fetchContentInput struct {
		workspaceInput
		URL string `json:"url" jsonschema:"Article page URL to extract full text from"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_fetch_article_content",
		Description: "Fetch a web page and extract readable full-text HTML (readability). Use when RSS content is truncated.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in fetchContentInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/rss/articles/fetch-content?url="+url.QueryEscape(in.URL), c.ws(in.workspaceInput))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_get_all_articles",
		Description: "Latest articles across all feeds (digest mode).",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in workspaceInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/rss/articles?view=all&mode=digest", c.ws(in))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_get_today_articles",
		Description: "Articles published today across all feeds.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in workspaceInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/rss/articles?view=today", c.ws(in))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_get_starred_articles",
		Description: "All starred/bookmarked articles.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in workspaceInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/rss/articles?view=starred", c.ws(in))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type feedArticlesInput struct {
		workspaceInput
		FeedID string `json:"feed_id" jsonschema:"Feed ID"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_get_feed_articles",
		Description: "Latest articles from a specific feed.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in feedArticlesInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/rss/articles?view=feed&feedId="+url.QueryEscape(in.FeedID), c.ws(in.workspaceInput))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_get_starred_count",
		Description: "Count of starred articles.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in workspaceInput) (*sdkmcp.CallToolResult, any, error) {
		res, err := c.get(ctx, "/api/rss/starred/count", c.ws(in))
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type toggleStarInput struct {
		workspaceInput
		ID        string `json:"id" jsonschema:"Article ID"`
		FeedID    string `json:"feedId" jsonschema:"Feed ID"`
		FeedName  string `json:"feedName" jsonschema:"Feed name"`
		Title     string `json:"title" jsonschema:"Title"`
		Link      string `json:"link" jsonschema:"Link"`
		PubDate   string `json:"pubDate" jsonschema:"Publication date"`
		Summary   string `json:"summary,omitempty"`
		Content   string `json:"content,omitempty"`
		Author    string `json:"author,omitempty"`
		IsStarred bool   `json:"isStarred,omitempty"`
		Starred   bool   `json:"starred" jsonschema:"true to star, false to unstar"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_toggle_star",
		Description: "Star or unstar an article.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in toggleStarInput) (*sdkmcp.CallToolResult, any, error) {
		article := map[string]any{
			"id": in.ID, "feedId": in.FeedID, "feedName": in.FeedName, "title": in.Title,
			"link": in.Link, "pubDate": in.PubDate, "summary": in.Summary, "content": in.Content,
			"author": in.Author, "isStarred": in.IsStarred,
		}
		res, err := c.post(ctx, "/api/rss/articles/star", c.ws(in.workspaceInput), map[string]any{"article": article, "starred": in.Starred})
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})

	type refreshInput struct {
		workspaceInput
		FeedID string `json:"feed_id,omitempty" jsonschema:"Optional feed ID; omit to refresh all"`
	}
	sdkmcp.AddTool(server, &sdkmcp.Tool{
		Name:        "rss_refresh_feeds",
		Description: "Refresh one feed or all feeds.",
	}, func(ctx context.Context, _ *sdkmcp.CallToolRequest, in refreshInput) (*sdkmcp.CallToolResult, any, error) {
		body := map[string]any{}
		if in.FeedID != "" {
			body["feedId"] = in.FeedID
		}
		res, err := c.post(ctx, "/api/rss/refresh", c.ws(in.workspaceInput), body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(res)
	})
}
