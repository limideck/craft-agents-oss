# Workbench Automations UI

Unified ActivityBar entry for **Automations**: **Rules** (classic `automations.json`) and **Flows** (workflow canvas). Phase 1 restores Rules CRUD/test in the workbench and folds the former standalone Workflows module under Flows.

See also: [workbench-architecture.md](./workbench-architecture.md), [workbench-workflows-ui.md](./workbench-workflows-ui.md), [workbench-workflows-contract.md](./workbench-workflows-contract.md).

## Product IA

| User intent | Surface | Implementation |
|-------------|---------|----------------|
| Schedule / label changed / start an Agent | **Rules** | `automations.json` + RPC (`useAutomations`) |
| Multi-step branch / HTTP / approval / canvas | **Flows** | `workflows:*` + grose-modules |

ActivityBar shows a single **Automations** icon (Zap). There is no separate Workflows ActivityBar item.

**Scheduling authority (Phase 1 copy):** everyday cron → **Rules → SchedulerTick**. Flow `schedule` / `webhook` nodes remain Deploy stub metadata; the editor shows a short “coming soon / use Rules” hint.

## How to open

1. Enable workbench: `GROSE_FEATURE_WORKBENCH_SHELL=1` or `localStorage` flag (see architecture doc).
2. ActivityBar → **Automations**.
3. Default surface is **Rules** (single-column `automation-detail`).
4. Switch segment to **Flows** → dock applies `workflow-edit` (canvas + logs + right).

Classic routes (`automations`, `automations/scheduled/...`, `automations/automation/{id}`) deep-link into Automations + Rules + selection/filter.

## Layout

```
[ActivityBar] [Rules|Flows list] [Rule detail  OR  Canvas↑+Logs↓ + Right tools]
```

| Surface | Dock | Side list |
|---------|------|-----------|
| Rules | `automation-detail` → `AutomationInfoPage` | `AutomationsListPanel` (+ Scheduled / Event / Agentic chips) |
| Flows | preset `workflow-edit` (`wf-canvas` / `wf-logs` / `wf-right`) | `WorkflowListView` |

Same-module surface switches call `applyLayout` / `resolveModuleLayout` from the activity view (no shell `if (module === …)` branches).

## Data

- Rules: `useAutomations` mounted in `WorkspaceDataProvider` → `automationsAtom` + AppShellContext handlers (test / toggle / duplicate / delete / history).
- Flows: existing `use-workflow-data.ts` / grose-modules RPC (unchanged under `modules/workflows/`).

Storage stays split in Phase 1 (`automations.json` vs workflow SQLite).

## Phase boundaries

**In Phase 1:** unified entry, Rules CRUD/test, Flows editor under Automations, deep-link, empty-state copy, i18n `workbench.automations.*`.

**Out of scope:** storage merge, cron/webhook runners, `run_workflow` action, rewriting `AutomationInfoPage` / canvas, changing classic AppShell Automations.

**Phase 2+ (planned):** one scheduling authority when Flow Deploy arms runners; Rules action `run_workflow`; shared Runs history; agent/MCP defaults to Rule unless multi-step.
