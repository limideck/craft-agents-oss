# Workbench Architecture

Craft’s personal workbench shell: **ActivityBar + dockview layout + Module registry**.

`frontend/` is a UX mock only — not merged into Electron. Layout engine patterns come from kandev (dockview + portals); session/chat data stays Craft.

## Enable the shell (dual-shell)

Default is the classic `AppShell`. Enable the new `WorkbenchShell` with either:

```bash
# Env (Electron / Vite process)
CRAFT_FEATURE_WORKBENCH_SHELL=1 bun run electron:dev
```

Or in DevTools:

```js
localStorage.setItem('craft-feature-workbench-shell', '1')
location.reload()
```

Disable: set to `0` / remove the key. Shared helper: `FEATURE_FLAGS.workbenchShell` / `isWorkbenchShellEnabled()`.

## Modules (this sprint)

| Module | Status |
|--------|--------|
| Agents | Session nav in ActivityBar + chat dock |
| Sources | List + detail (API / MCP / Local filters) |
| Skills | List + detail |
| Automations | Rules + Flows unified entry — [workbench-automations-ui.md](./workbench-automations-ui.md); Flows canvas — [workbench-workflows-ui.md](./workbench-workflows-ui.md); contract — [workbench-workflows-contract.md](./workbench-workflows-contract.md) |
| Connectors | Open Connector console (Overview/Providers/Actions/Runs/Access) |
| Settings | ActivityBar footer |
| RSS | UI mock (no RPC) — [workbench-rss-ui.md](./workbench-rss-ui.md) |
| Tables | Browse/upload/preview UI + plydb sidecar — [workbench-tables-ui.md](./workbench-tables-ui.md), [craft-tables-sidecar.md](./craft-tables-sidecar.md) |
| Knowledge | Placeholder only |

> **Note:** The former standalone **Workflows** ActivityBar module is no longer registered. Workflow UI lives under Automations → **Flows** (`modules/workflows/` code stays; `automationsModule` re-exports `wf-*` panels).

## Open Connector preview

```bash
# Optional: clone + build nested sidecar runtime
bun run setup:open-connector

# Or attach to an already-running instance
CRAFT_OPENCONNECTOR_URL=http://127.0.0.1:PORT CRAFT_FEATURE_WORKBENCH_SHELL=1 bun run electron:dev
```

With the workbench flag on, open the **Connectors** ActivityBar icon. Sidecar start failures are non-fatal; when ready, workspaces get an `open-connector` MCP source automatically.

See also: [docs/open-connector.md](./open-connector.md).

## Directory map

```
apps/electron/src/renderer/workbench/
  shell/WorkbenchShell.tsx     # TopBar + ActivityBar + DockviewHost
  shell/WorkbenchTopBar.tsx    # Workspace switcher + AppMenu
  shell/ActivityBar.tsx        # Module switcher (footer = Settings)
  providers/WorkspaceDataProvider.tsx  # sources/skills/automations → jotai atoms
  dock/
    DockviewHost.tsx           # DockviewReact + portal host
    panel-portal-*.ts(x)       # Persist panel React trees across fromJSON
    panel-primitives.tsx       # PanelRoot / PanelBody / bars
    dockview-theme.*           # --dv-* → Craft theme vars
    layout-manager/            # Slim presets + apply + localStorage persist
  registry/
    types.ts                   # WorkbenchModule / PanelContribution (frozen)
    module-registry.ts
    panel-registry.ts
  modules/
    agents/                    # Chat + session activityView
    sources/ | skills/ | settings/
    automations/               # Rules + Flows (ActivityBar entry)
    connectors/                # Open Connector console
    rss/                             # UI mock (no RPC)
    knowledge/                       # Placeholder
    workflows/                       # Flow canvas (registered via automations)
  store/workbench-store.ts     # Jotai: active module + dock API
```

Domain packages (backend skeletons):

- `packages/domain-rss`
- `packages/domain-knowledge`
- `packages/domain-workflows`

Mounted from `packages/server-core` via `registerDomainStubHandlers` (`rss:ping` / `knowledge:ping` / `workflows:ping`).

Phase 3+ backend direction: a single Go sidecar (`craft-modules`) with loopback HTTP for UI RPC proxies and MCP for agents — see [craft-modules-sidecar.md](./craft-modules-sidecar.md). Agent prefer-builtin routing (Module Registry + `<craft_modules>` context) — see [craft-modules-agent-routing.md](./craft-modules-agent-routing.md).

Workspace data (see [workspace-storage.md](./workspace-storage.md)):

```
{rootPath}/modules/{rss|tables|knowledge|workflows}/
```

Never key module data by `workspaceId` folder name under `~/.craft-agent/workspaces/{id}/` when `rootPath` is slug-named.

## Register a module

1. Create `workbench/modules/<id>/` exporting a `WorkbenchModule`.
2. Call `registerModule(...)` from `workbench/modules/index.ts`.
3. Optionally add `packages/domain-<id>/` + channel stubs in `protocol/channels.ts` + `routing.ts` + server-core mount.

**Do not** branch on `module === '…'` inside `DockviewHost` / `WorkbenchShell`.

### Contract (Phase 2 freeze)

```ts
type WorkbenchModule = {
  id: string
  title: string
  icon: ReactNode
  order: number
  defaultLayout?: LayoutPresetId | LayoutState
  panels: PanelContribution[]
  activityView?: ComponentType
  commands?: CommandContribution[]
}

type PanelContribution = {
  component: string
  title: string
  tabComponent?: string
  singleton?: boolean
  envScoped?: boolean
  render: (params) => ReactNode
}
```

## Layout persistence

- Key: `craft-panel-layout:workbench:{workspaceId}` (via renderer `localStorage` helper).
- Debounced on `api.onDidLayoutChange` (~400ms).
- On first open: `agents-default` preset — session-list | chat | files+changes / terminal (~18/38/44).

URL / deep link restores focus only; it does **not** serialize the full dock tree.

## Agents default layout

| Panel | Component | Role |
|-------|-----------|------|
| `session-list` | `session-list` | Left — Craft sessions atom (thin list) |
| `chat` | `chat` | Center — existing `ChatPage` |
| `files` | `files` | Right — file-tree + `listServerDirectory` |
| `changes` / `terminal` | placeholders | Phase 3+ |

## Portal rule

Heavy panels (chat, future browser/canvas/editors) render through `PanelPortalHost` so `fromJSON` remounts do not destroy React state.

## Phase boundary

| Phase | Status |
|-------|--------|
| 0 Scaffold (dockview, theme, portals, registries) | Done |
| 1 Dock shell + Agents + feature flag | Done |
| 2 Contracts + placeholder modules + domain skeletons | Done |
| 3+ RSS / KB / workflows business logic | UI mocks: [workbench-rss-ui.md](./workbench-rss-ui.md), [workbench-workflows-ui.md](./workbench-workflows-ui.md); workflows graph/HTTP/MCP freeze: [workbench-workflows-contract.md](./workbench-workflows-contract.md); backend design: [craft-modules-sidecar.md](./craft-modules-sidecar.md); agent prefer-builtin: [craft-modules-agent-routing.md](./craft-modules-agent-routing.md) |
