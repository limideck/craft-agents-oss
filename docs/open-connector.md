# OpenConnector integration

Grose Agents hosts [open-connector](../open-connector/) as a local sidecar process and registers it as a single HTTP MCP Source (`open-connector`). Agents discover and run provider actions through four MCP tools (`list_apps`, `search_actions`, `get_action_guide`, `execute_action`) instead of installing one skill/MCP per SaaS.

## Dev setup

1. Clone open-connector next to the grose repo root (already present if you followed the integration plan):

   ```bash
   # from grose-agents-oss/
   # open-connector/ is gitignored — keep it as a nested clone, not a bun workspace package
   bun run scripts/setup-open-connector.ts
   ```

   This runs `npm install` and `npm run generate:catalog` inside `open-connector/`.

2. Start Grose Electron as usual:

   ```bash
   bun run electron:dev
   ```

   On `app.whenReady`, the main process spawns the sidecar (system Node preferred), polls `GET /health`, then idempotently creates/updates the workspace MCP source.

### Manual sidecar (skip spawn)

Useful when iterating on open-connector itself:

```bash
cd open-connector
npm run start
# default http://127.0.0.1:3000
```

Then launch Grose with:

```bash
GROSE_OPENCONNECTOR_URL=http://127.0.0.1:3000 bun run electron:dev
```

Tokens still come from `~/.grose-agent/open-connector/sidecar-secrets.json` (or `$GROSE_CONFIG_DIR/open-connector/`). For an external instance, set matching `OOMOL_CONNECT_ADMIN_TOKEN` / `OOMOL_CONNECT_RUNTIME_TOKEN` / `OOMOL_CONNECT_ENCRYPTION_KEY` when starting open-connector, or copy values from the secrets file.

### IPC (for the native console UI)

| Method | Channel | Result |
|--------|---------|--------|
| `getOpenConnectorStatus()` | `openConnector:getStatus` | `{ ready, baseUrl, adminToken, runtimeToken, ... }` |
| `getOpenConnectorConfig()` | `openConnector:getConfig` | Starts sidecar if needed → `{ baseUrl, adminToken, runtimeToken, ready }` |
| `restartOpenConnector()` | `openConnector:restart` | Restart + re-ensure MCP source |
| `openConnectorFetch(req)` | `openConnector:fetch` | Main-process HTTP proxy to the sidecar (avoids Vite↔sidecar CORS) |

Renderer admin calls should use `@grose-agent/open-connector-client` with `baseUrl` + `adminToken` from IPC, and an IPC-backed `fetch` (`openConnectorFetch`) so catalog requests are not blocked by CORS.

## Data & secrets

| Path / env | Purpose |
|------------|---------|
| `~/.grose-agent/open-connector/` | SQLite runtime DB + sidecar secrets |
| `sidecar-secrets.json` | `adminToken`, `runtimeToken`, `encryptionKey` (mode 0600) |
| `OOMOL_CONNECT_ORIGIN` | Set to `http://127.0.0.1:{port}` for OAuth callbacks |
| `GROSE_OPENCONNECTOR_NODE` | Optional path to Node binary (dev) |

## OAuth (Google, GitHub, etc.)

1. Open the OpenConnector Providers UI (native pages land in a follow-up) or call the sidecar admin API.
2. For OAuth providers, configure the client ID/secret in OpenConnector’s OAuth configs (`PUT /api/oauth/configs/{service}`).
3. Redirect URI must match `OOMOL_CONNECT_ORIGIN` + open-connector’s callback path (typically `/oauth/callback`).
4. Authorization opens in the system browser; after redirect, the sidecar stores the connection. Refresh the Providers view (or poll connections) to see status.

Provider-specific app registration (Google Cloud Console, GitHub OAuth Apps, …) is unchanged from open-connector’s own docs — use the Grose-managed origin as the redirect base.

## Packaging (production)

`apps/electron/electron-builder.yml` includes an `extraResources` entry that copies a prebuilt open-connector bundle when present:

```text
apps/electron/resources/open-connector/
  server/index.js   # bundled Node entry
  catalog/…         # pre-generated catalog assets
  node_modules/…    # production deps (or a single bundled artifact)
```

Build steps (minimal viable):

```bash
bun run scripts/setup-open-connector.ts
# Then produce a Node-runnable server bundle into apps/electron/resources/open-connector/
# (esbuild/rollup of open-connector/src/server + copy catalog). Documented hook only —
# full CI packaging can land with the release pipeline.
```

If the packaged entry is missing, the app skips spawn and logs a warning; set `GROSE_OPENCONNECTOR_URL` for debugging packaged builds against an external runtime.

## Relation to Sources → MCPs

OpenConnector is a “super MCP”: one workspace source covers 800+ providers. You generally do **not** need a separate MCP/skill per SaaS once the provider is connected in OpenConnector. Existing per-service Sources remain valid for specialized auth or tools.
