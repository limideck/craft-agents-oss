# craft-modules

Go sidecar for Craft Agents workbench modules (RSS v1). Loopback HTTP + MCP on a single process.

## Build

```bash
# From repo root (preferred) — also stages Electron resources
bun run build:craft-modules

# Or locally
cd services/craft-modules
make build      # → bin/craft-modules
make dist-host  # → dist/<goos>-<goarch>/
make dist       # all Electron targets
```

## Run (dev)

```bash
export PORT=4711
export CRAFT_WORKSPACES_ROOT="$HOME/.craft-agent/workspaces"
export CRAFT_MODULES_TOKEN="dev-token"   # optional
./bin/craft-modules --port "$PORT"
```

Health check (no auth):

```bash
curl -s http://127.0.0.1:4711/health
```

RSS API (requires workspace header; bearer if token set):

```bash
curl -s -H "X-Craft-Workspace-Id: default" \
  -H "Authorization: Bearer dev-token" \
  http://127.0.0.1:4711/api/rss/feeds
```

MCP Streamable HTTP: `POST http://127.0.0.1:{PORT}/mcp`

## Data layout

Per workspace SQLite at:

```text
{CRAFT_WORKSPACES_ROOT}/{workspaceId}/modules/rss/rss.db
```

## Environment

| Variable | Flag | Description |
|----------|------|-------------|
| `PORT` | `--port` | Listen port on `127.0.0.1` (required; parent sets ephemeral port) |
| `CRAFT_WORKSPACES_ROOT` | — | Workspace root (default `~/.craft-agent/workspaces`) |
| `CRAFT_MODULES_DB_ROOT` | `--db-root` | Legacy per-workspace parent (`{root}/{id}/rss.db`) |
| `CRAFT_MODULES_TOKEN` | `--token` | Bearer token for `/api/*` and `/mcp` |
| `CRAFT_DEFAULT_WORKSPACE_ID` | — | Default workspace for MCP tools without `workspace_id` |
| `CRAFT_MODULES_LOG_DIR` | `--log-dir` | Reserved for future file logging |

## MCP tools

All tools accept optional `workspace_id` (falls back to `CRAFT_DEFAULT_WORKSPACE_ID`):

- `rss_list_feeds`, `rss_add_feed`, `rss_rename_feed`, `rss_delete_feed`, `rss_import_opml`
- `rss_get_all_articles`, `rss_get_today_articles`, `rss_get_starred_articles`, `rss_get_feed_articles`
- `rss_get_starred_count`, `rss_toggle_star`, `rss_refresh_feeds`
