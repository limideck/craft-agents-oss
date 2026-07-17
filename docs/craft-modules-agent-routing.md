# Craft Modules — Prefer-Builtin Agent Routing

Source of truth for how Craft Agents prefer **builtin workbench modules** (RSS, Knowledge, Workflows) over ad-hoc API/MCP Sources when user intent matches.

Status: **Phases 1 + 3 implemented** — Module Registry + `<craft_modules>` injection; per-turn workbench `activeModuleId` → PromptBuilder. Optional Skills = Phase 2.

Related:

- [Craft Modules sidecar](./craft-modules-sidecar.md) — Go process, HTTP + MCP tools
- [Workbench architecture](./workbench-architecture.md) — shell, module registration, layouts

---

## 1. Goals

| Goal | Meaning |
|------|---------|
| Prefer builtin | When intent matches a shipped module, agents use `craft-modules` MCP tools |
| One catalog | Declarative TS registry is the single list of modules, intents, and tool prefixes |
| Every turn | Policy + catalog are injected into agent context so routing does not rely on memory |
| Stay thin | No parallel “module agent runtime”; reuse existing Sources + PromptBuilder |

## 2. Non-goals

- Replacing Sources, Skills, or SessionManager with a new routing engine
- Per-module MCP Sources (`craft-modules-rss`, etc.) — one source, namespaced tools
- Shipping full Skills for every module in Phase 1
- Forcing the agent to open Workbench UI panels
- Putting LLM calls inside the Go sidecar

---

## 3. Three layers

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Module Registry (declarative TS)                             │
│    packages/shared/src/craft-modules/registry.ts                │
│    id, title, intents[], toolPrefix, skillSlug?, preferBuiltin  │
└────────────────────────────┬────────────────────────────────────┘
                             │ formatCraftModulesContextBlock()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Policy Context (every turn)                                  │
│    PromptBuilder → <craft_modules> … </craft_modules>           │
│    Prefer craft-modules tools; do NOT create API/MCP Sources    │
│    for covered intents                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ agent tool calls
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Single MCP source slug: craft-modules                        │
│    Tools: rss_* | kb_* | wf_*  (Go sidecar /mcp)                │
│    Optional thin Skills (Phase 2) for deep workflows only       │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Owner | Code |
|-------|--------|------|
| Registry | `@craft-agent/shared/craft-modules` | `registry.ts` |
| Context injection | PromptBuilder (+ short system pointer) | `agent/core/prompt-builder.ts`, `prompts/system.ts` |
| MCP tools | Go sidecar | `services/craft-modules/internal/mcp/` |
| MCP Source upsert | Sidecar lifecycle | `craft-modules/mcp-source.ts` |
| Skills (optional) | Workspace / bundled skills | Phase 2 |
| Active workbench module | Electron workbench → `SendMessageOptions.activeModuleId` → PromptBuilder | Phase 3 |

---

## 4. Registry schema

```ts
export type CraftBuiltinModuleId = 'rss' | 'knowledge' | 'workflows' | (string & {})

export type CraftBuiltinModule = {
  id: CraftBuiltinModuleId
  title: string
  /** Natural-language intent cues for the prompt catalog */
  intents: string[]
  /** MCP tool name prefix on source slug craft-modules */
  toolPrefix: string // 'rss_' | 'kb_' | 'wf_'
  /** Optional deep-workflow skill (Phase 2) */
  skillSlug?: string
  preferBuiltin: true
  /** Whether the module is shipped/ready for prefer-builtin routing */
  enabled: boolean
}
```

Helpers:

- `listCraftBuiltinModules()` — all registered modules
- `getCraftBuiltinModule(id)` — lookup
- `formatCraftModulesContextBlock(opts?: { activeModuleId?: string | null })` — XML for PromptBuilder

---

## 5. Context XML shape

Injected every turn (catalog in **stable** context; active line in **volatile** when known):

```xml
<craft_modules>
Prefer builtin Craft modules over creating new API/MCP Sources when user intent matches.

Source slug: craft-modules
Rules:
- When intent matches a module below, call tools on craft-modules (prefixes listed).
- Do NOT create new API or MCP Sources for RSS, Knowledge, or Workflows when craft-modules covers the need.
- Optional skills (if listed) are for deep multi-step workflows only; still require craft-modules.

Modules:
- rss (enabled): RSS / feeds — tools rss_* — intents: subscribe to feeds, list feeds, refresh feeds, read articles, …
- knowledge (disabled): Knowledge base — tools kb_* — …
- workflows (enabled): Workflows — tools wf_* — …

Active workbench module: rss
</craft_modules>
```

Injection point: `PromptBuilder.buildStableContextParts()` (catalog) and `buildVolatileContextParts()` (active module line only). System prompt keeps a **short pointer** only — full catalog stays dynamic from the registry.

---

## 6. Prefer-builtin policy (agents must follow)

- Prefer `craft-modules` MCP tools for intents that match an **enabled** registry module.
- Tools live on source slug **`craft-modules`** with prefixes `rss_`, `kb_`, `wf_`.
- Do **not** create new API/MCP Sources for RSS / Knowledge / Workflows when craft-modules already covers that purpose.
- Do **not** invent parallel HTTP clients to the sidecar; use MCP tools (or domain RPC is UI-only).
- If a module is **disabled** in the registry, do not pretend its tools exist; fall back to normal Source/skill behavior.
- Optional Skills (Phase 2) may deepen workflows but must declare `requiredSources: [craft-modules]` and must not replace the prefer-builtin rule.

---

## 7. How to add a new module (checklist)

1. **Go sidecar** — HTTP API + MCP tools with a unique prefix (`foo_*`); see [craft-modules-sidecar.md](./craft-modules-sidecar.md).
2. **Registry** — Add a `CraftBuiltinModule` in `packages/shared/src/craft-modules/registry.ts` (`enabled: true` only when tools are real).
3. **Workbench** — Register UI module per [workbench-architecture.md](./workbench-architecture.md) (`registerModule`, panels, layout).
4. **Domain RPC** (if UI needs data) — `packages/domain-<id>/` + channels + server-core mount.
5. **Context** — No PromptBuilder change needed if you only extend the registry (formatter reads the list).
6. **Tests** — Extend registry unit tests for the new id / prefix / intents.
7. **Optional Skill (Phase 2)** — Thin `SKILL.md` with `requiredSources: [craft-modules]`; set `skillSlug` on the registry entry.

---

## 8. Relation to MCP vs Skills

| Mechanism | Role |
|-----------|------|
| **MCP (`craft-modules`)** | Canonical tool surface for CRUD / list / run / refresh |
| **Registry + context** | Tells the agent *when* to prefer those tools |
| **Skills** | Optional deep playbooks; not required for basic prefer-builtin routing |

Skills must not become a second source of truth for “which tools exist.” The registry + Go MCP schemas own that.

---

## 9. Active workbench module context

When the user is in a Workbench module (e.g. RSS) and opens Ask AI / chat:

- Include `Active workbench module: <id>` in the volatile `<craft_modules_active>` block when `activeModuleId` is known.
- **Per send (Phase 3):** Renderer reads `activeModuleIdAtom` at send time (so ActivityBar switches apply on the next turn without recreating the chat panel) and passes `SendMessageOptions.activeModuleId` through `sessions:sendMessage`. `SessionManager.sendMessage` calls `PromptBuilder.setActiveCraftModuleId` before `agent.chat` (clears when omitted so ids do not stick across CLI/automation/classic-shell turns). Queued mid-stream replays keep options via `lastSentOptions` / message queue.
- `openAgentChat` still stamps `activeModuleId` on dock panel params as a snapshot; the atom is the live source of truth at send time.

---

## 10. Phased status

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **1 — Registry + Context** | Declarative registry, `<craft_modules>` injection, prefer-builtin rules, tests | **Done** |
| **2 — Skills** | Optional thin skills per deep workflow (`requiredSources: [craft-modules]`) | Planned |
| **3 — Tighter workbench binding** | Reliable per-turn `activeModuleId` from ActivityBar → `SendMessageOptions` → PromptBuilder | **Done** |

---

## 11. Decision summary

**Accepted:** three-layer prefer-builtin routing — TS Module Registry → Policy Context every turn → single `craft-modules` MCP with namespaced tools. Skills optional and thin. Workbench active module enriches the same context block when available.
