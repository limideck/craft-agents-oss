# Workbench Workflows editor (UI)

Phase 2 Flows editor for the Grose workbench shell (under **Automations → Flows**). Canvas uses `@xyflow/react`; graph CRUD is persisted through **grose-modules** via `domain-workflows` RPC (`workflows:*`). Shapes align with [workbench-workflows-contract.md](./workbench-workflows-contract.md).

Product entry and Rules vs Flows IA: [workbench-automations-ui.md](./workbench-automations-ui.md).

## How to open

1. Build the Go sidecar once: `bun run build:grose-modules`
2. Start Electron (`bun run electron:dev` / usual app entry). Main spawns `grose-modules` (or attach with `GROSE_MODULES_URL`).
3. In the ActivityBar (far left), click **Automations**, then the **Flows** segment.
4. Left aside shows the flow list; dock applies the `workflow-edit` preset.

If you previously opened an older Workflows layout, clear the saved dock layout for that workspace (or wipe `grose-panel-layout:workbench:*` keys in localStorage) so the preset applies.

If the list shows a sidecar / connection error, build/start grose-modules or set `GROSE_MODULES_URL` (same as RSS).

## Locked layout (tabs on the right)

```
[ActivityBar] [Automations: Flows list] [Canvas ↑ + Logs ↓] [Chat | Toolbar | Editor + Deploy/Run]
```

| Region | Panel / component | Role |
|--------|-------------------|------|
| Flow list | Automations activityView → Flows → `WorkflowListView` | Create / delete via RPC, select / open; highlight selected — **not** a dock center panel |
| Canvas | `wf-canvas` → `CanvasPanel` | `@xyflow/react` nodes/edges, pan/zoom, connect; edits debounce-persist |
| Logs | `wf-logs` → `LogsPanel` | Per-node run steps (list + Output \| Input JSON); session lines when idle |
| Right tools | `wf-right` → `RightPanel` | Internal tabs Chat \| Toolbar \| Editor; Deploy (`workflows:deploy`) / Run (`workflows:run`) |

Dock preset `workflow-edit`: center column ~0.62 (canvas / logs vertical split) + right ~0.38 (single panel). Right tab bodies stay mounted (CSS `hidden`); they are not three separate dock tabs.

## Data path

```
UI (Jotai cache) → electronAPI.workflows* → domain-workflows RPC → grose-modules HTTP /api/workflows
```

Workspace store: `{rootPath}/modules/workflows/` (see [workspace-storage.md](./workspace-storage.md)). Definitions currently live in `workflows.db`; `definitions/` is reserved for a future file SoT.

| UI action | RPC channel |
|-----------|-------------|
| Module open / refresh | `workflows:list` |
| New workflow | `workflows:create` |
| Graph edits (nodes, edges, config, positions) | `workflows:update` (debounced) |
| Delete workflow | `workflows:delete` |
| Run | `workflows:run` (Go accepts; Grose executes `agent` nodes → real Logs output) |
| Deploy | `workflows:deploy` (flush pending save → Go publishes live snapshot) |

Hook: `use-workflow-data.ts` (same pattern as RSS `use-rss-data.ts`). Optimistic local updates; authority is the Go store.

Sample graphs in `mock/data.ts` are **not** seeded into the store (dev/docs only). An empty sidecar list shows the Flows empty-state copy (use Rules for simple schedules).

## Interactions

- **Create workflow** — `workflows:create` with a Start node; selects the new id.
- **Delete workflow** — hover trash → `workflows:delete`.
- **Select workflow** — loads that graph on the canvas (React Flow remounts per workflow).
- **Click canvas node** — sets `selectedNodeId` and switches right tab to **Editor**.
- **Connect handles** — drag source → target; cycle-creating edges are rejected (toast); then persist.
- **Toolbar block** — **click** or **drag** onto the canvas (`{ type }` payload). Sections: **Triggers / AI / Flow / Data / Action** with colored category dots, accent icon tiles, title + description rows, and a search filter.
- **Drag node** — position updates locally on drag end, then debounced `workflows:update`.
- **Delete / Backspace** — removes the selected node (and its edges) or selected edge; persists.
- **Branching** — `condition` (`true`/`false`), `switch` (case ids + `default`), `filter` (`pass`/`drop`), `loop` (`item`/`done`), `human-approval` (`approved`/`rejected`), `question-classifier` (category ids).
- **Editor** — writable form from `BlockConfig.fields` → writes `name` / `config` → persist.
- **Run** — flushes pending persists, calls `workflows:run`. Grose runs `agent` nodes via a real session; Logs show per-node Input / Output (agent Output is model text). Selecting a step highlights the canvas node.
- **Logs** — left: step list (icon, name, duration, error); right: **Output** \| **Input** tabs with expandable JSON tree (type tags). Resizable split inside the panel.
- **Deploy** — flushes pending persists, calls `workflows:deploy`. Canvas header + list show **Deployed · vN**. Logs line on success. Schedule/webhook nodes are armed in metadata only (runners stub).
- **Chat** — placeholder copy only.

## Graph data shape (contract-aligned)

```ts
WorkflowSummary { id, name, description?, updatedAt, status, version, deployedAt?, nodes[], edges[] }
WorkflowNode    { id, type, name, position: { x, y }, config: Record<string, unknown> }
WorkflowEdge    { id, source, target, sourceHandle?, targetHandle? }
WorkflowNodeType =
  // Triggers
  'start' | 'schedule' | 'webhook' |
  // AI
  'agent' | 'generate-image' | 'parameter-extractor' | 'question-classifier' |
  // Flow
  'condition' | 'switch' | 'filter' | 'merge' | 'loop' | 'human-approval' |
  // Data
  'variables' | 'set-fields' | 'template' | 'json' | 'transform' | 'function' |
  // Action
  'http' | 'wait' | 'response' | 'subworkflow'
```

Wire types: `@grose-agent/shared/grose-modules` (`GroseModulesWorkflow*`). Block registry: `modules/workflows/blocks/`.

## UI state (Jotai)

- `workflowsAtom` — cache of RPC list (create / mutate / delete)
- `workflowLoadingAtom` / `workflowErrorAtom` — load / sidecar status
- `selectedWorkflowIdAtom`
- `selectedNodeIdAtom` / `selectedEdgeIdAtom`
- `workflowRightTabAtom` — `'chat' | 'toolbar' | 'editor'`
- `workflowLogsAtom` — session log lines (deploy / persist / add-block)
- `workflowRunStepsAtom` / `selectedLogStepIdAtom` — last stub run’s per-node steps + selection
- `workflowNodeRunStatusAtom` — optional run rings (`idle` \| `running` \| `success` \| `error`)

### Run step shape (Logs)

```ts
WorkflowRunStep {
  id, nodeId, name, nodeType, status: 'success'|'error'|'running'|'skipped',
  durationMs, input, output, error?
}
```

Synthesized from the graph on Run (Go stub returns the same shape; UI falls back to local synthesis). Not a real executor.

## Grose styling

Uses existing electron / Grose tokens (`bg-card`, `border-border`, `text-muted-foreground`, `foreground-5/10`, panel primitives). Does **not** use frontend `--ide-*` tokens. React Flow base stylesheet: `@xyflow/react/dist/style.css`.

## Out of scope (this phase)

Graph executor for all node types, Loop/Parallel tooling catalog, cron/webhook runners that fire runs, multi-version rollback UI, real Chat, undo stack.

See also: [workbench-workflows-contract.md](./workbench-workflows-contract.md), [workbench-architecture.md](./workbench-architecture.md), [workbench-rss-ui.md](./workbench-rss-ui.md), [grose-modules-sidecar.md](./grose-modules-sidecar.md).
