# Craft Modules Sidecar (Go)

Design boundary for local workbench modules (**RSS first**; Knowledge and Workflows later) as a single Go sidecar process, exposed to Craft Agents via loopback HTTP (UI) and MCP (AI).

Status: **In progress** — RSS sidecar + UI live; SQLITE busy hardening + A5 packaging landed.

Related:

- [Workbench architecture](./workbench-architecture.md) — shell, `domain-*` stubs, data path convention
- [Workspace storage](./workspace-storage.md) — **rootPath-only** hard rule
- [Prefer-builtin agent routing](./craft-modules-agent-routing.md) — Module Registry + `<craft_modules>` context
- [Workbench RSS UI mock](./workbench-rss-ui.md) — panel contract the backend must feed
- [Workbench Workflows contract](./workbench-workflows-contract.md) — frozen graph model, node configs, `/api/workflows`, MCP `wf_*`
- [Workbench Workflows UI mock](./workbench-workflows-ui.md) — editor shell (mock until RPC)
- [OpenConnector sidecar](./open-connector.md) — lifecycle / health / MCP source pattern to mirror
- Reference implementations (exploration only): `test/yarr`, `test/feedoverflow`, `test/craft-agents-oss-old/examples/apps/rss`

---

## 1. Goals

| Goal | Meaning |
|------|---------|
| Independent data plane | Fetch, parse, persist, and background jobs live outside the Bun/Electron agent runtime |
| One process | RSS (+ later KB / workflows) share one binary — not three sidecars |
| Dual consumers | Workbench UI via domain RPC; Craft AI via MCP tools on the same store |
| Dual hosts | Electron desktop and headless `@craft-agent/server` can both start (or attach to) the sidecar |
| Align with conventions | Workspace data under `{rootPath}/modules/...` (see [workspace-storage.md](./workspace-storage.md)); MCP as a normal workspace Source |

## 2. Non-goals (v1)

- Replacing SessionManager, agent backends (Claude / Pi), or chat RPC with Go
- Putting LLM / embedding calls inside the Go process (Go stores and retrieves; Craft agents call models)
- Three separate Go services for rss / knowledge / workflows
- Renderer talking directly to Go over HTTP (always go through `domain-*` RPC)
- Shipping a full yarr/feedoverflow UI inside Craft (Workbench panels stay React)
- Migrating OpenConnector into this binary

---

## 3. Ownership boundary

```
┌─────────────────────────────────────────────────────────────────┐
│ Craft (TypeScript / Bun / Electron)                             │
│  • Workbench UI (React)                                         │
│  • domain-rss | domain-knowledge | domain-workflows (thin RPC)  │
│  • SessionManager, models, skills, Sources registry             │
│  • Sidecar lifecycle (spawn / health / stop / MCP source)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ loopback HTTP (+ optional token)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ craft-modules (Go) — single long-lived process                  │
│  • SQLite + file layout per workspace module                    │
│  • RSS fetch / parse / refresh worker                           │
│  • HTTP JSON API (UI + internal)                                │
│  • MCP endpoint (Streamable HTTP) — thin wrappers over HTTP API │
│  • Later: knowledge index / workflow job runners (same binary)  │
└─────────────────────────────────────────────────────────────────┘
```

| Concern | Owner |
|---------|--------|
| Panel layout, Jotai UI state, dock presets | Electron renderer |
| RPC channel names, routing, auth to workspace | `packages/shared` + `server-core` |
| Proxy: RPC → Go HTTP | `packages/domain-*` |
| Spawn, port, health, secrets, MCP Source upsert | Electron main **and** headless server bootstrap (shared helper preferred) |
| Feed/article persistence, OPML, refresh schedule | Go |
| MCP tool schemas + handlers | Go (`/mcp`) |
| Agent tool selection / prompting | Prefer-builtin registry + `<craft_modules>` context — see [craft-modules-agent-routing.md](./craft-modules-agent-routing.md); optional Skills later |
| Embedding model choice / LLM steps (incl. workflow `agent` nodes) | Craft agents (TS `server-core`); Go only exposes search / CRUD / run-accept |

**Hard rule:** one authoritative store. Do not keep a parallel TS feed cache that can diverge from Go SQLite (avoid the old Craft App split where UI used `@craft-agent/shared/feed` and MCP used workspace files separately).

---

## 4. Process model

### 4.1 Name and packaging

| Item | Value |
|------|--------|
| Binary name | `craft-modules` |
| Repo location (planned) | `services/craft-modules/` (Go module; **not** a bun workspace package) |
| Packaged path | `apps/electron/resources/craft-modules/{platform-arch}/craft-modules[.exe]` via `extraResources` |
| Dev attach | `CRAFT_MODULES_URL=http://127.0.0.1:{port}` skips spawn (same idea as `CRAFT_OPENCONNECTOR_URL`) |

### 4.2 Lifecycle (mirror OpenConnector)

1. Allocate ephemeral loopback port (or reuse attach URL).
2. Spawn binary with env: data root, bind address, optional auth token, log dir.
3. Poll `GET /health` until ready (timeout ~60s); start failure is **non-fatal** (Workbench shows degraded state; Agents simply lack the MCP source).
4. Idempotently upsert workspace MCP Source (slug `craft-modules`, HTTP transport → `{baseUrl}/mcp`).
5. Add `craft-modules` to workspace `defaults.enabledSourceSlugs` so **new sessions auto-activate** the Source (prefer-builtin). SessionManager also merges usable preferred builtins into existing sessions — see [Session activation](./craft-modules-agent-routing.md#12-session-activation-配置了但未激活). Users should not need a manual Sources toggle for RSS MCP tools.
5. On app / server quit: SIGTERM → wait → SIGKILL.

Headless `@craft-agent/server` must use the same helper (or a shared package under `packages/` that only knows spawn + health — no Electron APIs).

### 4.3 Network posture

| Listener | Bind | Auth | Serves |
|----------|------|------|--------|
| Primary (only) | `127.0.0.1` | Optional shared bearer (Craft-generated, stored under `~/.craft-agent/craft-modules/`) | `/health`, `/api/*`, `/mcp` |

No public / LAN bind in v1. If a second “public” listener is ever needed (remote server deploy), add it behind an explicit flag — default remains loopback-only.

---

## 5. Data layout

Aligned with [workspace-storage.md](./workspace-storage.md) (**rootPath-only**):

```text
~/.craft-agent/
  craft-modules/
    sidecar-secrets.json     # bearer token (mode 0600), process-level only
  config.json                # registry: workspace id → absolute rootPath

{rootPath}/                  # never assume basename === workspaceId
  modules/
    rss/
      rss.db                 # SQLite (WAL)
    workflows/
      workflows.db
      definitions/           # preferred file SoT (future); DB is SoT today
    knowledge/               # reserved
    tables/                  # plydb (separate sidecar) — see craft-tables-sidecar.md
```

Multi-workspace: single Go process; every API/MCP call carries `X-Craft-Workspace-Id`. Prefer also sending absolute `X-Craft-Workspace-Root` from Electron/TS. When the root header is omitted, Go looks up `id → rootPath` in `config.json`. Switching workspaces does not require a craft-modules restart.

---

## 6. API surfaces

### 6.1 HTTP (source of truth for UI)

Consumed only by `domain-*` RPC handlers (and by MCP handlers inside Go via loopback self-calls, as in feedoverflow).

Sketch for RSS v1 (names freeze at implementation time; shape matches Workbench mock):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | `{ ok, version, modules: ["rss"] }` |
| GET | `/api/rss/feeds` | List feeds |
| POST | `/api/rss/feeds` | Subscribe `{ url, name? }` |
| PATCH | `/api/rss/feeds/{id}` | Rename |
| DELETE | `/api/rss/feeds/{id}` | Unsubscribe |
| POST | `/api/rss/feeds/import-opml` | Bulk import |
| GET | `/api/rss/feeds/export-opml` | Export all feeds as OPML XML |
| GET | `/api/rss/articles` | Query: `view`, `feedId`, `mode`, `q`, `limit` |
| GET | `/api/rss/articles/fetch-content` | Readability full text: `?url=` (SSRF-guarded) |
| GET | `/api/rss/articles/{id}` | Full article body |
| POST | `/api/rss/articles/star` | Star / unstar |
| POST | `/api/rss/refresh` | Refresh one feed or all |

Folder CRUD can land in the same `/api/rss/folders*` set when UI needs it.

### 6.2 Domain RPC (Workbench)

Keep channels under `RPC_CHANNELS.rss.*`. Handlers in `@craft-agent/domain-rss` become thin HTTP clients to the sidecar.

| RPC (planned) | Maps to |
|---------------|---------|
| `rss:ping` | `/health` |
| `rss:listFeeds` | `GET /api/rss/feeds` |
| `rss:addFeed` | `POST /api/rss/feeds` |
| `rss:renameFeed` / `rss:deleteFeed` | `PATCH` / `DELETE /api/rss/feeds/{id}` |
| `rss:listArticles` | `GET /api/rss/articles` |
| `rss:getArticle` | `GET /api/rss/articles/{id}` |
| `rss:fetchArticleContent` | `GET .../articles/fetch-content?url=` |
| `rss:toggleStar` / `rss:starredCount` | Star APIs |
| `rss:refresh` | `POST /api/rss/refresh` |
| `rss:importOpml` / `rss:exportOpml` | OPML import / export |

Renderer continues to use existing preload/RPC paths — **no new IPC style** for RSS data. Optional sidecar status IPC (`craftModules:getStatus`) may mirror OpenConnector for Settings / degraded banners only.

### 6.3 MCP (Agents)

- Transport: HTTP MCP at `{baseUrl}/mcp` (Streamable HTTP; match Craft’s existing HTTP MCP client).
- Tools are thin wrappers over the same HTTP API (feedoverflow pattern).
- Source slug: `craft-modules` (or `craft-modules-rss` if we later split registration; prefer one source with namespaced tool names).

**RSS tool set (v1 target):**

| Tool | Role |
|------|------|
| `rss_list_feeds` | List subscriptions |
| `rss_add_feed` | Subscribe by URL |
| `rss_rename_feed` / `rss_delete_feed` | Manage subscriptions |
| `rss_import_opml` / `rss_export_opml` | Bulk import / export OPML |
| `rss_get_*_articles` / `rss_toggle_star` / `rss_refresh_feeds` | Articles + star + refresh |
| `rss_fetch_article_content` | Readability full text for a URL |

Prefix tools with `rss_` so Knowledge / Workflows can add `kb_*` / `wf_*` in the same MCP server without collision.

Optional bundled skill (later): `skills/rss-reader` that documents tools + when to call them. Prefer-builtin routing (registry + context) is specified in [craft-modules-agent-routing.md](./craft-modules-agent-routing.md).

---

## 7. TypeScript integration points

| Package / file | Change |
|----------------|--------|
| `services/craft-modules/` | New Go module |
| `packages/domain-rss` | Replace ping-only stubs with HTTP proxy + types shared with UI |
| `packages/shared` protocol | Add real `rss:*` channels beyond `PING` |
| `packages/server-core` | Keep mounting `registerRssRpcHandlers`; ensure sidecar URL reachable from both hosts |
| `apps/electron/src/main/craft-modules-sidecar.ts` | New lifecycle module (clone OpenConnector patterns) |
| Headless server entry | Same start/attach helper |
| `apps/electron/.../workbench/modules/rss/` | Swap mock atoms for RPC-backed queries; keep panel IDs / layout preset |
| `electron-builder.yml` | `extraResources` for per-arch binaries |
| CI | Cross-compile `darwin-arm64`, `darwin-x64`, `linux-x64`, `win-x64` |

---

## 8. Knowledge & Workflows (later boundaries)

Same binary, separate packages under Go (`internal/rss`, `internal/knowledge`, `internal/workflows`), separate SQLite/dirs, same `/health` module list.

| Module | Go owns | Craft (TS) still owns |
|--------|---------|------------------------|
| **Knowledge** | Document ingest, chunk metadata, local index/search tools, file blobs under `modules/knowledge/` | Embedding provider selection, chat RAG orchestration, UI |
| **Workflows** | Durable job defs, cron/triggers, step run log, calling HTTP/MCP actions as steps | Agent sessions as a step type, human-in-the-loop UI, model picks |

Workflows Phase 2 freezes the shared graph + CRUD surface in [workbench-workflows-contract.md](./workbench-workflows-contract.md) (`Workflow` / `Node.type` / `Edge`, `/api/workflows*`, MCP `wf_list`…`wf_run` / `wf_deploy`). **Deploy** snapshots the draft as live (`deployed_definition_json` + version); schedule/webhook triggers are recorded as armed but runners remain stub. Executor for non-agent nodes remains deferred; UI uses `domain-workflows` RPC.

Do **not** start Knowledge implementation until RSS HTTP + MCP + Workbench path is stable. Workflows CRUD may proceed against the contract in parallel with UI xyflow work.

---

## 9. Reference mapping

| Reference | Take | Leave |
|-----------|------|-------|
| `test/feedoverflow/server-go` | Loopback API + `/mcp` self-call, SQLite, refresh jobs | Standalone product UI, public auth port |
| `test/yarr` | Parser/storage simplicity, single-binary ops feel | No MCP; different UI model |
| Old `examples/apps/rss` Go MCP | Tool naming / agent-facing surface | Dual storage (TS + Go); stdio-only; iframe Craft App shell |
| OpenConnector sidecar | Spawn, health, secrets, MCP Source upsert, attach URL | Node runtime, admin console scope |

---

## 10. Phased delivery

| Phase | Deliverable | Exit criteria |
|-------|-------------|----------------|
| **A0 — Boundary** | This doc + links from workbench docs | Reviewed / accepted |
| **A1 — Skeleton** | `craft-modules` with `/health`, empty RSS routes, Electron spawn + attach env | Health green in Electron; failure non-fatal |
| **A2 — RSS core** | SQLite schema, subscribe/list/refresh/articles/read | CLI or HTTP smoke tests; no UI yet |
| **A3 — MCP** | `/mcp` tools + auto Source registration | Agent can list/add feeds via tools |
| **A4 — Domain RPC + UI** | `domain-rss` proxy; Workbench drops mock for live data | RSS panels work end-to-end offline-capable with real DB |
| **A5 — Packaging** | Cross-compile + `extraResources` + headless parity | Packaged app starts sidecar without Go toolchain — **done** (`bun run build:craft-modules`) |
| **B / C** | Knowledge / Workflows modules in-process | Separate design addenda |

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Dual-language CI / notarization cost | Single binary matrix; start with macOS arm64 in A1, expand in A5 |
| Sidecar down → broken UI | Non-fatal start; UI empty/error state; `rss:ping` reports degraded |
| Workspace switch races | Require `X-Craft-Workspace-Id` on every mutating call; document isolation |
| MCP vs RPC drift | MCP tools only call internal HTTP; one OpenAPI-ish list maintained in Go |
| Scope creep into agent runtime | Explicit non-goals; workflow “run LLM step” delegates back to Craft |

---

## 12. Open decisions (resolve at A1 kickoff)

1. **Auth token:** always-on bearer for loopback vs trust loopback-only until remote deploy exists.  
   *Recommendation:* always-on token (cheap, matches OpenConnector).
2. **Workspace routing:** header vs path prefix `/api/workspaces/{id}/rss/...`.  
   *Decision:* header `X-Craft-Workspace-Id` + optional `X-Craft-Workspace-Root`; persistence resolves via registry (see [workspace-storage.md](./workspace-storage.md)).
3. **Repo path:** `services/craft-modules` vs `apps/craft-modules`.  
   *Recommendation:* `services/` to signal “not Electron UI”.
4. **MCP source slug:** `craft-modules` vs per-module sources.  
   *Recommendation:* one source, prefixed tool names.

---

## 13. Decision summary

**Accepted:** implement workbench local modules (RSS → KB → workflows) as **one Go sidecar** with loopback HTTP + MCP; Craft TS owns UI, RPC bus, agent runtime, and process lifecycle; Go owns persistence and background work. Follow OpenConnector for lifecycle and feedoverflow for API+MCP co-location.
