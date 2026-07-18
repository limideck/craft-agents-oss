# Workbench Sites (建站)

Agent-driven site IDE for the Grose workbench shell: real Vite + React source under the workspace, not a drag-and-drop CMS. Backend is the **grose-modules** Go sidecar (`internal/sites`); UI follows a Chat | Files | Preview dock (Doable-style editor; kandev Design scaffolding).

See [grose-modules-sidecar.md](./grose-modules-sidecar.md) for process / API / MCP boundaries. Prefer-builtin routing: [grose-modules-agent-routing.md](./grose-modules-agent-routing.md).

## Module contract

| Field | Value |
|-------|--------|
| id | `sites` |
| ActivityBar title | Sites / 建站 (`workbench.sites.title`) |
| order | `65` (after Knowledge `60`, before legacy Workflows `70`) |
| Storage | `{rootPath}/modules/sites/` |

On-disk layout:

```text
{rootPath}/modules/sites/
├── sites.db              # project metadata (SQLite)
└── {slug}/               # Vite + React + TS + Tailwind project
    ├── package.json
    ├── src/
    └── .grose-sites.json
```

Separate from `{rootPath}/projects/` (session-bound light projects).

## How to open

1. Build once: `bun run build:grose-modules`
2. Enable the workbench shell:
   - DevTools: `localStorage.setItem('grose-feature-workbench-shell', '1')` then reload, **or**
   - Env: `GROSE_FEATURE_WORKBENCH_SHELL=1`
3. Start Electron (`bun run electron:dev`). Main process spawns `grose-modules` (or attach with `GROSE_MODULES_URL`).
4. ActivityBar → **Sites**. Dock preset: **Chat | Files | Preview**.

If the list shows a sidecar / connection error, build/start grose-modules or set `GROSE_MODULES_URL` (same as RSS).

## Regions

| Region | Panel | Role |
|--------|--------|------|
| Site list | ActivityBar `activityView` | Create / select / open sites; template picker on create |
| Chat | `sites-chat` | Reuses Agents `ChatPanel`; session `cwd` = site root |
| Files | `sites-files` | Project tree + file read (Monaco optional later) |
| Preview | `sites-preview` | Vite iframe, restart, visual-edit bridge |

Default layout (three columns):

```text
[ActivityBar] [Site list] [ Chat | Files | Preview ]
```

## Data path

```text
UI → electronAPI.sites* → domain-sites RPC → grose-modules HTTP /api/sites
```

**Hard rule:** the renderer never calls Go HTTP directly. Always go through preload / `domain-sites` (same pattern as RSS `domain-rss` and Workflows `domain-workflows`).

Pass `X-Grose-Workspace-Id` (+ optional `X-Grose-Workspace-Root`) on every request. Never assume `basename(rootPath) === workspaceId`.

Workspace store: `{rootPath}/modules/sites/` — see [workspace-storage.md](./workspace-storage.md).

## Templates

Scaffolded by grose-modules from embedded Vite templates:

| Id | Role |
|----|------|
| `blank` | Minimal Vite + React + TS + Tailwind |
| `landing` | Landing-page starter |
| `website` | Multi-section marketing site starter |

Each template scaffolds project skills under `.agents/skills/` (`website-layout`, `component-spec`, `design-workflow`) so site-bound agent sessions pick them up via the project skills convention.

## Preview

Vite dev servers are managed by the grose-modules preview manager (ports **5400+** per site). Preview panel loads the assigned URL in an iframe; Restart calls preview stop/start via RPC.

## MCP (Agents)

Tools live on the single `grose-modules` MCP source with prefix `sites_*` (prefer-builtin enabled in the Module Registry). Target set includes:

| Tool | Role |
|------|------|
| `sites_list` / `sites_create` | List / scaffold projects |
| `sites_list_files` / `sites_read_file` / `sites_write_file` | Module-aware FS |
| `sites_preview_start` | Start / ensure Vite preview |
| `sites_run_command` | Restricted project commands |

When intent matches Sites, agents prefer these tools over inventing new API/MCP Sources — see [grose-modules-agent-routing.md](./grose-modules-agent-routing.md).

## Visual edit (MVP)

Preview point-and-edit (text / basic styles) posts changes through RPC (`sitesVisualEditSave` / visual-edit save) so grose-modules writes back into the project source. Not a full design system editor.

## Out of scope (v1)

- Doable data plane (`@doable/data`, PGlite, end-user auth)
- Custom domain / one-click Cloudflare publish (optional local `sites_build` → `dist/` may follow later)
- PPT / independent Design workspace
- Next.js or non-Vite frameworks

## Dev attach (optional)

```bash
cd services/grose-modules
PORT=4711 GROSE_MODULES_TOKEN=dev make run
GROSE_MODULES_URL=http://127.0.0.1:4711 GROSE_FEATURE_WORKBENCH_SHELL=1 bun run electron:dev
```
