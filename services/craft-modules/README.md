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

On macOS, `make build` / `make dist-host` use `CGO_ENABLED=1` so Go uses the system DNS resolver. Pure-Go DNS (`CGO_ENABLED=0`) can fail to resolve public hosts on some macOS setups.
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
curl -s -H "X-Craft-Workspace-Id: <registry-id>" \
  -H "X-Craft-Workspace-Root: $HOME/.craft-agent/workspaces/my-slug" \
  -H "Authorization: Bearer dev-token" \
  http://127.0.0.1:4711/api/rss/feeds
```

MCP Streamable HTTP: `POST http://127.0.0.1:{PORT}/mcp`

## Data layout

Per-workspace SQLite under the workspace disk root (not `{workspacesRoot}/{workspaceId}`):

```text
{rootPath}/modules/rss/rss.db
{rootPath}/modules/workflows/workflows.db
```

Resolve `workspaceId → rootPath` via `X-Craft-Workspace-Root` and/or `~/.craft-agent/config.json` (see [workspace-storage.md](../../docs/workspace-storage.md)).

## Environment

| Variable | Flag | Description |
|----------|------|-------------|
| `PORT` | `--port` | Listen port on `127.0.0.1` (required; parent sets ephemeral port) |
| `CRAFT_CONFIG_PATH` | — | Global registry JSON (`id → rootPath`); default `~/.craft-agent/config.json` |
| `CRAFT_WORKSPACES_ROOT` | — | Legacy default workspaces parent (not used as sole module path) |
| `CRAFT_MODULES_TOKEN` | `--token` | Bearer token for `/api/*` and `/mcp` |
| `CRAFT_DEFAULT_WORKSPACE_ID` | — | Default workspace for MCP tools without `workspace_id`. Electron sets this to the active workspace id on sidecar spawn. |
| `CRAFT_MODULES_LOG_DIR` | `--log-dir` | Reserved for future file logging |

HTTP headers:

| Header | Required | Description |
|--------|----------|-------------|
| `X-Craft-Workspace-Id` | yes | Registry workspace id |
| `X-Craft-Workspace-Root` | no | Absolute workspace `rootPath` (preferred when known) |

## MCP tools

All tools accept optional `workspace_id` (falls back to `CRAFT_DEFAULT_WORKSPACE_ID`). **Agents must use the `workspace_id` from the session `<craft_modules>` context** (same id as the Workbench UI) — do not invent ids or copy a mismatched id from a workspace folder `config.json`.

- `rss_list_feeds`, `rss_add_feed`, `rss_rename_feed`, `rss_delete_feed`, `rss_import_opml`, `rss_export_opml`
- `rss_get_all_articles`, `rss_get_today_articles`, `rss_get_starred_articles`, `rss_get_feed_articles`
- `rss_get_starred_count`, `rss_toggle_star`, `rss_refresh_feeds`, `rss_fetch_article_content`
