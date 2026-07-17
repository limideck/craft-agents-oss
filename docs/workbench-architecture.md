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

## Directory map

```
apps/electron/src/renderer/workbench/
  shell/WorkbenchShell.tsx     # ActivityBar + DockviewHost
  shell/ActivityBar.tsx        # Module switcher (no module-specific branches)
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
    agents/                    # Chat + session-list + files shell
    rss/ | knowledge/ | workflows/   # Placeholders
  store/workbench-store.ts     # Jotai: active module + dock API
```

Domain packages (backend skeletons):

- `packages/domain-rss`
- `packages/domain-knowledge`
- `packages/domain-workflows`

Mounted from `packages/server-core` via `registerDomainStubHandlers` (`rss:ping` / `knowledge:ping` / `workflows:ping`).

Workspace data (future):

```
~/.craft-agent/workspaces/{id}/modules/{rss|knowledge|workflows}/
```

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
| 3+ RSS / KB / workflows business logic | Not in scope |
