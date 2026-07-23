# Grose Modules — Prefer-Builtin Agent Routing

Source of truth for how Grose Agents prefer **builtin workbench modules** (RSS, Knowledge, Sites, Workflows) over ad-hoc API/MCP Sources when user intent matches.

Status: **Phases 1 + 3 + session activation implemented** — Module Registry + `<grose_modules>` injection; per-turn workbench `activeModuleId` → PromptBuilder; prefer-builtin Source auto-enabled. Optional Skills = Phase 2. **Layer 4 (Module Actions)** = planned / landing — silent UI tasks on the same Runtime + MCP (see §13).

Related:

- [Grose Modules sidecar](./grose-modules-sidecar.md) — Go process, HTTP + MCP tools
- [Workspace storage](./workspace-storage.md) — rootPath-only persistence contract
- [Workbench architecture](./workbench-architecture.md) — shell, module registration, layouts
- [Workbench Local Reader (RSS)](./workbench-rss-ui.md) — first Module Action UX (Reader chips → result panel)

---

## 1. Goals

| Goal | Meaning |
|------|---------|
| Prefer builtin | When intent matches a shipped module, agents use `grose-modules` MCP tools |
| One catalog | Declarative TS registry is the single list of modules, intents, and tool prefixes |
| Every turn | Policy + catalog are injected into agent context so routing does not rely on memory |
| Stay thin | No parallel “module agent runtime”; reuse existing Sources + PromptBuilder |
| Silent UI tasks | Module buttons run as Actions (auto-run → result panel); instructions stay off the user Composer |

## 2. Non-goals

- Replacing Sources, Skills, or SessionManager with a new routing engine
- Per-module MCP Sources (`grose-modules-rss`, etc.) — one source, namespaced tools
- **Per-module heavy agent runtimes** — do not ship a separate SessionManager / MCP stack / long system prompt per workbench module
- Shipping full Skills for every module in Phase 1 (or for every UI button)
- Forcing the agent to open Workbench UI panels
- Putting LLM calls inside the Go sidecar

---

## 3. Four layers

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Module Registry (declarative TS)                             │
│    packages/shared/src/grose-modules/registry.ts                │
│    id, title, intents[], toolPrefix, skillSlug?, preferBuiltin  │
└────────────────────────────┬────────────────────────────────────┘
                             │ formatGroseModulesContextBlock()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Policy Context (every turn)                                  │
│    PromptBuilder → <grose_modules> … </grose_modules>           │
│    Prefer grose-modules tools; do NOT create API/MCP Sources    │
│    for covered intents                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ agent tool calls
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Single MCP source slug: grose-modules                        │
│    Tools: rss_* | sites_* | kb_* | wf_*                         │
│    Optional thin Skills (Phase 2) for deep workflows only       │
└────────────────────────────┬────────────────────────────────────┘
                             │ UI button / chip (not open chat)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Module Actions (silent tasks) — planned / landing            │
│    ActionDef + moduleActions.run → mini session + MCP + result  │
│    Same Runtime as Chat / workflow agent nodes; no Nth agent    │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Owner | Code |
|-------|--------|------|
| Registry | `@grose-agent/shared/grose-modules` | `registry.ts` |
| Context injection | PromptBuilder (+ short system pointer) | `agent/core/prompt-builder.ts`, `prompts/system.ts` |
| MCP tools | Go sidecar | `services/grose-modules/internal/mcp/` |
| MCP Source upsert | Sidecar lifecycle | `grose-modules/mcp-source.ts` |
| Skills (optional) | Workspace / bundled skills | Phase 2 |
| Active workbench module | Electron workbench → `SendMessageOptions.activeModuleId` → PromptBuilder | Phase 3 |
| Module Actions | Action registry + silent runner (reuse workflow `runAgentStep` pattern) | Layer 4 (planned / landing) |

---

## 4. Registry schema

```ts
export type GroseBuiltinModuleId = 'rss' | 'knowledge' | 'sites' | 'workflows' | (string & {})

export type GroseBuiltinModule = {
  id: GroseBuiltinModuleId
  title: string
  /** Natural-language intent cues for the prompt catalog */
  intents: string[]
  /** MCP tool name prefix on source slug grose-modules */
  toolPrefix: string // 'rss_' | 'kb_' | 'sites_' | 'wf_'
  /** Optional deep-workflow skill (Phase 2) */
  skillSlug?: string
  preferBuiltin: true
  /** Whether the module is shipped/ready for prefer-builtin routing */
  enabled: boolean
}
```

Helpers:

- `listGroseBuiltinModules()` — all registered modules
- `getGroseBuiltinModule(id)` — lookup
- `formatGroseModulesContextBlock(opts?: { activeModuleId?: string | null })` — XML for PromptBuilder

---

## 5. Context XML shape

Injected every turn (catalog in **stable** context; active line in **volatile** when known):

```xml
<grose_modules>
Prefer builtin Grose modules over creating new API/MCP Sources when user intent matches.

Source slug: grose-modules
Rules:
- When intent matches a module below, call tools on grose-modules (prefixes listed).
- Do NOT create new API or MCP Sources for RSS, Knowledge, Sites, or Workflows when grose-modules covers the need.
- Optional skills (if listed) are for deep multi-step workflows only; still require grose-modules.

Modules:
- rss (enabled): RSS / feeds — tools rss_* — intents: subscribe to feeds, list feeds, refresh feeds, read articles, …
- knowledge (disabled): Knowledge base — tools kb_* — …
- sites (enabled): Sites / 建站 — tools sites_* — intents: create site, scaffold landing page, edit site files, start preview, …
- workflows (enabled): Workflows — tools wf_* — …

Active workbench module: sites
</grose_modules>
```

Injection point: `PromptBuilder.buildStableContextParts()` (catalog) and `buildVolatileContextParts()` (active module line only). System prompt keeps a **short pointer** only — full catalog stays dynamic from the registry.

---

## 6. Prefer-builtin policy (agents must follow)

- Prefer `grose-modules` MCP tools for intents that match an **enabled** registry module.
- Tools live on source slug **`grose-modules`** with prefixes `rss_`, `sites_`, `kb_`, `wf_`.
- Do **not** create new API/MCP Sources for RSS / Knowledge / Sites / Workflows when grose-modules already covers that purpose.
- Do **not** invent parallel HTTP clients to the sidecar; use MCP tools (or domain RPC is UI-only).
- If a module is **disabled** in the registry, do not pretend its tools exist; fall back to normal Source/skill behavior.
- Optional Skills (Phase 2) may deepen workflows but must declare `requiredSources: [grose-modules]` and must not replace the prefer-builtin rule.

---

## 7. How to add a new module (checklist)

1. **Go sidecar** — HTTP API + MCP tools with a unique prefix (`foo_*`); see [grose-modules-sidecar.md](./grose-modules-sidecar.md).
2. **Registry** — Add a `GroseBuiltinModule` in `packages/shared/src/grose-modules/registry.ts` (`enabled: true` only when tools are real). For Sites: `id: 'sites'`, `toolPrefix: 'sites_'`, `preferBuiltin: true`, `enabled: true`.
3. **Workbench** — Register UI module per [workbench-architecture.md](./workbench-architecture.md) (`registerModule`, panels, layout). Sites: [workbench-sites-ui.md](./workbench-sites-ui.md).
4. **Domain RPC** (if UI needs data) — `packages/domain-<id>/` + channels + server-core mount (`domain-sites` → `/api/sites`).
5. **Context** — No PromptBuilder change needed if you only extend the registry (formatter reads the list).
6. **Tests** — Extend registry unit tests for the new id / prefix / intents.
7. **Optional Skill (Phase 2)** — Thin `SKILL.md` with `requiredSources: [grose-modules]`; set `skillSlug` on the registry entry.
8. **Optional Module Actions (Layer 4)** — Declare UI-button ActionDefs (`instruction` hidden, `toolPrefixes`, `resultUi`); wire chips to `moduleActions.run` + result panel, not Composer seed. See §13.

---

## 8. Relation to MCP vs Skills vs Actions

| Mechanism | Role |
|-----------|------|
| **MCP (`grose-modules`)** | Canonical tool surface for CRUD / list / run / refresh |
| **Registry + context** | Tells the agent *when* to prefer those tools |
| **Skills** | Optional deep playbooks (multi-step); not required for basic prefer-builtin or for simple UI buttons |
| **Module Actions** | Silent UI tasks: fixed instruction + allowlisted tools → result panel (see §13) |
| **Chat** | Open-ended multi-turn; escalate from an Action result only when the user asks |

Skills must not become a second source of truth for “which tools exist.” The registry + Go MCP schemas own that. Actions must not become a second Runtime — they configure the existing session/agent step path.

---

## 9. Active workbench module context

When the user is in a Workbench module (e.g. RSS) and opens Ask AI / chat:

- Include `Active workbench module: <id>` in the volatile `<grose_modules_active>` block when `activeModuleId` is known.
- **Per send (Phase 3):** Renderer reads `activeModuleIdAtom` at send time (so ActivityBar switches apply on the next turn without recreating the chat panel) and passes `SendMessageOptions.activeModuleId` through `sessions:sendMessage`. `SessionManager.sendMessage` calls `PromptBuilder.setActiveGroseModuleId` before `agent.chat` (clears when omitted so ids do not stick across CLI/automation/classic-shell turns). Queued mid-stream replays keep options via `lastSentOptions` / message queue.
- `openAgentChat` still stamps `activeModuleId` on dock panel params as a snapshot; the atom is the live source of truth at send time.

---

## 10. Phased status

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **1 — Registry + Context** | Declarative registry, `<grose_modules>` injection, prefer-builtin rules, tests | **Done** |
| **2 — Skills** | Optional thin skills per deep workflow (`requiredSources: [grose-modules]`) | Planned |
| **3 — Tighter workbench binding** | Reliable per-turn `activeModuleId` from ActivityBar → `SendMessageOptions` → PromptBuilder | **Done** |
| **4 — Session auto-activate** | Prefer-builtin Source auto-enabled in workspace defaults + sessions (no manual Sources toggle) | **Done** |
| **5 — Module Actions** | Silent UI tasks (`moduleActions.run`), ActionDef registry, Reader chips → result panel (not Composer seed) | Planned / landing — see §13 |

---

## 11. Decision summary

**Accepted:** prefer-builtin routing — TS Module Registry → Policy Context every turn → single `grose-modules` MCP with namespaced tools. Skills optional and thin. Workbench active module enriches the same context block when available.

**Accepted (Layer 4):** module UI binds a **capability pack** (tools + Actions + optional Skill) on **one Runtime**. Do **not** ship a heavy independent Agent stack per module. Product language may say “Reader Agent”; implementation is `moduleId` + Actions + `rss_*` (+ optional skill), not a separate process.

---

## 12. Session activation (“配置了但未激活”)

### What “未激活” means

Two different flags exist:

| Layer | Field | Meaning |
|-------|--------|---------|
| **Source on disk** | `sources/grose-modules/config.json` → `enabled: true` | Source is configured / usable |
| **Session** | `enabledSourceSlugs` includes `grose-modules` | MCP tools are loaded for **this** chat |

Agents see the latter via `<sources>`:

```text
Active: …
Inactive: grose-modules (inactive)   ← configured on disk, not in this session
```

Prefer-builtin context (`<grose_modules>`) still tells the model to prefer `rss_*` tools, so the model may say “先激活 grose-modules” when the slug is inactive.

### How activation works today

1. **Automatic (preferred — local workspaces):**
   - Sidecar startup / `ensureGroseModulesMcpSource` upserts the Source **and** adds `grose-modules` to workspace `defaults.enabledSourceSlugs`.
   - **New sessions** merge preferred builtins into `enabledSourceSlugs` at create time.
   - **Existing sessions** are healed on app load, message hydrate, and each `sendMessage` when the on-disk Source is usable — users should **not** need to toggle Sources for RSS / Sites / Workflows.
2. **Manual (fallback):** Chat input Sources chips / panel → enable `grose-modules` (same as any MCP Source). Workspace Settings → default sources also controls new-session defaults.
3. **Agent path:** `source_test` (or failed tool → `onSourceActivationRequest`) can activate mid-turn; prefer-builtin auto-enable makes this unnecessary for grose-modules.

### Restart behavior

After restart, sidecar re-ensures the Source + workspace defaults. Session heal re-adds `grose-modules` if it was missing. Treat it as an **always-on preferred builtin** for local workspaces while the sidecar Source exists — not something users should manually activate for normal RSS use.

### Code pointers

- Upsert + workspace defaults: `packages/shared/src/grose-modules/mcp-source.ts` (`ensureGroseModulesMcpSource`, `ensureGroseModulesInWorkspaceDefaults`)
- Session merge: `packages/shared/src/sources/preferred-builtin.ts` → `SessionManager` (`mergePreferredBuiltinSourceSlugs`, `ensurePreferredBuiltinSourcesInSession`)
- Active vs inactive formatting: `packages/shared/src/agent/core/source-manager.ts` (`formatSourceState`)

---

## 13. Layer 4: Module Actions (silent UI tasks)

Status: **architecture + intended contract** — Reader is the first landing surface. Server runner (`moduleActions.run`) and Reader result-panel wiring land with the implementation todos; until then chips may still seed Chat (see [workbench-rss-ui.md](./workbench-rss-ui.md)).

### Why this layer exists

Workbench chips (e.g. Reader **翻译** / **总结要点**) are **structured tasks**, not open chat. Seeding a long instruction into the Composer treats internal orchestration as a user message. Module Actions run those tasks **silently**: click → auto-run → result panel. Hidden instructions never appear in the user Composer by default.

This matches the existing workflow pattern (`runAgentStep` in `execute-workflow-run.ts`: ephemeral / mini session, optional skill, send → wait → collect final assistant text) — **reuse that Runtime**, do not invent a per-module agent stack.

### Actions vs Skills vs Chat

| Path | When to use | What the user sees |
|------|-------------|-------------------|
| **Module Action** | Fixed UI button: translate, summarize, structure, selection rewrite | Loading → markdown (or annotation) result; instruction hidden |
| **Skill** | Deep multi-step playbook (research, complex workflow) | Still one Runtime; Skill attached to session / Action |
| **Chat** | Open questions, multi-turn, user-edited instructions | Dock composer; escalate from Action via “发给 AI / 继续讨论” with **short** context only |

Rules of thumb:

- Shallow buttons → **Action** (template + MCP read by id; never paste full article into the prompt when an id exists).
- Deep workflows → optional **Skill** (`skillSlug` / `requiredSources: [grose-modules]`).
- Continue discussing → **Chat** only on explicit escalate.

### One Runtime, many configs

“Different modules bind different capabilities” means binding **Action defs + tool prefix allowlist + optional Skill** — not another Agent process.

| Product language | Implementation |
|------------------|----------------|
| Reader Agent | `moduleId=rss` Action set + `rss_*` + optional `skill:rss-reader` |
| Workflow Agent node | Already: skill slug → mini session (`runAgentStep`) |
| Knowledge Agent | Future: `kb_*` Actions + optional research Skill |

Shared pieces for every Action run:

- Same `SessionManager` / Claude·Pi backend
- Source slug `grose-modules` (namespaced tools)
- Prefer-builtin registry + `<grose_modules>` context (with `activeModuleId` when known)
- `systemPromptPreset: 'mini'` (or equivalent short preset)

### Intended ActionDef shape

Declarative defs live beside (or under) the Module Registry — exact module path may land with the server todo:

```ts
type ModuleActionDef = {
  id: 'rss.translate' | 'rss.summarize_bullets' | string
  moduleId: 'rss' | GroseBuiltinModuleId
  title: string
  /** Hidden instruction template; may reference {{articleId}} {{url}} — NOT shown in Composer */
  instruction: string
  /** Optional skill slug for deeper playbooks */
  skillSlug?: string
  /** Prefer / enforce tool name prefixes on grose-modules */
  toolPrefixes?: Array<'rss_' | 'kb_' | 'sites_' | 'wf_'>
  resultUi: 'inline-panel' | 'toast' | 'annotation'
  scope: 'article' | 'selection'
}
```

### Intended run contract

1. UI calls `runModuleAction(actionId, { articleId, selection?, … })` (renderer).
2. Server `moduleActions.run`:
   - Ephemeral session or module-pinned mini session pool
   - `systemPromptPreset: 'mini'`
   - `enabledSourceSlugs` includes `grose-modules`
   - `activeModuleId` from the Action’s `moduleId`
   - `skillSlugs` when the ActionDef sets `skillSlug`
3. Send a **hidden / system-side** user message: instruction template + ids (and short selection quote if `scope: 'selection'`). **Do not** embed full article body when `articleId` is available.
4. Agent calls MCP (e.g. `rss_get_article`, then `rss_fetch_article_content` if truncated) → produces output.
5. RPC returns `resultMarkdown` (or structured result) → UI renders the Action’s `resultUi` (Reader: inline result panel).
6. Optional escalate: `openAgentChat` only when the user chooses “继续讨论 / 发给 AI”, with a **short** reference (title, action id, brief excerpt) — never the full internal instruction / MCP playbook.

```
Chip / popup action
        │
        ▼
 moduleActions.run  ──►  mini session + grose-modules MCP (+ optional Skill)
        │
        ▼
 result panel (copy / write annotation / escalate to Chat)
```

### Non-goals for Layer 4 (this stage)

- Full multi-agent configuration UI
- Per-module independent OAuth / model stacks
- Replacing the workflow engine (workflow agent nodes may later share the same Action primitive)
- Exposing Action instructions in the Composer by default

### First landing: Reader

See [workbench-rss-ui.md](./workbench-rss-ui.md) § AI — target UX is click → auto-run → result panel; current code may still seed Chat until the runner and panel ship.

