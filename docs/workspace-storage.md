# Workspace storage (rootPath-only)

Hard rule: **all workspace-related data lives under that workspace’s disk directory (`rootPath`)**.

There is **no migration** from older layouts. Wipe leftover global / id-keyed data under `~/.grose-agent` if you still have it from earlier builds.

## Contract

1. **One workspace = one disk root** — `Workspace.rootPath` from the global registry (`~/.grose-agent/config.json`).
2. **Everything belonging to that workspace** lives under `rootPath` (sources, sessions, skills, projects, automations, modules).
3. API/MCP may still route by `workspaceId`, but **persistence must resolve `id → rootPath` first**, then read/write under that path.
   - Never assume `basename(rootPath) === workspaceId`.
   - Never store module data at `~/.grose-agent/workspaces/{workspaceId}/...` when the real folder is `{slug}/`.
4. **Global-only** (stay outside the workspace folder):
   - App registry (`~/.grose-agent/config.json`)
   - Preferences, themes, LLM/OAuth credentials
   - Sidecar process secrets/tokens/ports (`~/.grose-agent/grose-modules/sidecar-secrets.json`, `~/.grose-agent/tables/sidecar-secrets.json`)
5. Session `workingDirectory` may still point at a user project elsewhere (the agent *operates on* that tree). Grose-**generated** data must still land in `rootPath`.

## Directory tree

```text
{rootPath}/
├── config.json
├── sources/
├── sessions/
├── skills/
├── projects/
├── automations.json
├── permissions.json
├── statuses/
├── labels/
└── modules/
    ├── rss/
    │   └── rss.db                    # (+ optional favicons/, exports/)
    ├── tables/
    │   ├── catalog/workspace.duckdb
    │   ├── files/{sourceId}/…
    │   ├── config.json
    │   └── access.json
    ├── knowledge/                    # reserved (docs/, knowledge.db, index/)
    │   ├── docs/
    │   └── index/
    ├── sites/
    │   ├── sites.db                  # site project metadata
    │   └── {slug}/                   # Vite + React project tree
    └── workflows/
        ├── workflows.db              # runs / deploy meta / definitions (current SoT)
        └── definitions/              # preferred file SoT for graph YAML/JSON (future)
```

Default create location is still `~/.grose-agent/workspaces/{slug}/`, but the slug is only a folder name — the registry `id` is independent.

## Sidecar path resolution

### grose-modules (RSS + Sites + Workflows)

| Mechanism | Role |
|-----------|------|
| `X-Grose-Workspace-Id` | Required routing key (same as Workbench `activeWorkspaceId`) |
| `X-Grose-Workspace-Root` | Optional absolute `rootPath`; preferred when Electron/TS already knows it |
| `GROSE_CONFIG_PATH` / `~/.grose-agent/config.json` | Registry lookup `id → rootPath` when the root header is omitted (MCP tools) |

Resolved DB paths:

- RSS: `{rootPath}/modules/rss/rss.db`
- Sites: `{rootPath}/modules/sites/sites.db` (+ Vite projects under `{rootPath}/modules/sites/{slug}/`)
- Workflows: `{rootPath}/modules/workflows/workflows.db`

TS helper: `resolveWorkspaceRootPath(workspaceId)` in `@grose-agent/shared/config`.  
Path builders: `getWorkspaceRssDbPath` / `getWorkspaceSitesPath` / `getWorkspaceTablesDataPath` / … in `@grose-agent/shared/workspaces`.

### Tables (plydb)

| Item | Location |
|------|----------|
| Data dir | `{rootPath}/modules/tables/` |
| Process secrets | `~/.grose-agent/tables/sidecar-secrets.json` (global) |

One plydb process binds `--data-dir` to the **active** workspace’s `modules/tables`. On workspace switch, Electron restarts/rebinds the sidecar to the new data dir.

## Agent guidance

- Pass `workspace_id` from `<grose_modules>` (never invent paths).
- Do **not** write or assume `~/.grose-agent/tables/` for uploads/catalog.
- Do **not** invent `workspaces/{uuid}/modules/...` for module data.

## Follow-ups

- Workflow graph definitions: prefer files under `modules/workflows/definitions/` as source of truth; today definitions remain in `workflows.db` under the same workspace root.
- Multi-workspace concurrent Tables MCP (one process per workspace, or per-request data dir) if agents need non-active workspaces simultaneously.
