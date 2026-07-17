# Workbench Workflows — shared contract (Phase 2 freeze + Phase 2.5 blocks)

Frozen graph model, node configs, HTTP, and MCP surfaces for parallel UI (`@xyflow/react`) and Go (`craft-modules` / `internal/workflows`) work.

**Status:** Graph persistence via `workflows:*` RPC → Go CRUD. **Run:** Go accepts `POST .../run` (runId); Craft (`server-core`) executes `agent` nodes via SessionManager and returns real step I/O. Other node types remain lightweight stubs. **Phase 2.5+** BlockConfig registry (~29 types) for editor/palette.

Related:

- [Workbench Workflows UI](./workbench-workflows-ui.md) — Phase 2 `@xyflow/react` editor (aligned `type` / `position` / `edges`)
- [Craft Modules sidecar](./craft-modules-sidecar.md) — Go owns persistence; MCP `wf_*` tools
- [Workbench architecture](./workbench-architecture.md) — module shell + domain stubs

---

## 1. Ownership

| Concern | Owner |
|---------|--------|
| Graph persistence (SQLite), CRUD HTTP, MCP `wf_*`, run enqueue (accept + runId) | **Go** (`craft-modules` / `internal/workflows`) |
| Agent / LLM / HITL steps when a run hits those types | **Craft** (TS `server-core` SessionManager; `workflows:run` orchestrates) |
| Canvas, BlockConfig registry, Editor forms | **Electron Workbench UI** |
| Thin RPC → Go HTTP (CRUD); run orchestration | `packages/domain-workflows` + `server-core` workflows-run |

**Hard rules**

- One authoritative store in Go. Do not keep a divergent TS persistence layer.
- Renderer never talks to Go HTTP directly — always `domain-workflows` RPC (same as RSS).
- Graph **execution** for agent nodes is owned by Craft. Go `POST .../run` accepts the run and may synthesize stub steps for non-LLM tooling; Craft replaces/rebuilds steps with real agent output.
- Storage is opaque `definition_json` — **new node `type` values need no schema migration**. Create/update accept arbitrary `type` strings in nodes.

---

## 2. Graph model

Canonical TypeScript shapes (Go stores the same JSON in `definition_json`).

```ts
type Workflow = {
  id: string
  name: string
  /** Optional; UI mock has it — allowed on create/update, may be omitted in list summaries. */
  description?: string
  nodes: Node[]
  edges: Edge[]
  /** ISO-8601 */
  updatedAt: string
}

type Node = {
  id: string
  /** Discriminator — see §3. Not `kind`. */
  type: NodeType
  /** Display title on the canvas. Maps from mock `label`. */
  name: string
  position: { x: number; y: number }
  /** Keys depend on `type` — see field tables. Values are JSON-serializable. */
  config: Record<string, unknown>
}

type Edge = {
  id: string
  source: string
  target: string
  /** Default single output handle is `"source"` when omitted. */
  sourceHandle?: string
  /** Default single input handle is `"target"` when omitted. */
  targetHandle?: string
}

type NodeType =
  // Triggers
  | 'start' | 'schedule' | 'webhook'
  // AI
  | 'agent' | 'generate-image' | 'parameter-extractor' | 'question-classifier' | 'text-splitter'
  // Flow
  | 'condition' | 'switch' | 'filter' | 'merge' | 'loop' | 'human-approval'
  // Data
  | 'variables' | 'set-fields' | 'template' | 'json' | 'transform' | 'function'
  | 'batch' | 'aggregator' | 'csv' | 'sanitize'
  // Action
  | 'http' | 'wait' | 'response' | 'debug' | 'subworkflow'
```

### Naming vs Phase 1 UI mock

| Phase 1 mock | Contract / Phase 2 UI |
|--------------|------------------------|
| `kind` | `type` |
| `label` | `name` |
| `x`, `y` | `position: { x, y }` |
| (no edges) | `edges[]` required |
| `end` | `response` (terminal / API reply) |
| — | add `function`, `variables`, `wait` + Phase 2.5 set |

Phase 2 UI mock store uses contract field names directly.

### Handles (canvas / edges)

| Node type | Incoming | Outgoing `sourceHandle` values |
|-----------|----------|--------------------------------|
| Triggers (`start`, `schedule`, `webhook`) | none (or optional) | `source` |
| Most blocks | `target` | `source` |
| `condition` | `target` | `true`, `false` |
| `switch` | `target` | case ids from `config.cases` (`case0`, `case1`, …) + `default` |
| `filter` | `target` | `pass`, `drop` |
| `loop` | `target` | `item`, `done` |
| `human-approval` | `target` | `approved`, `rejected` |
| `question-classifier` | `target` | category ids from `config.categories` |
| `response` | `target` | none (terminal) |

---

## 3. Node types (Phase 2.5+ — ~29)

Prefer core / control-flow / AI / data / action primitives (old Craft palette groups). **Not** an OAuth SaaS catalog.

| Category | `type` | Role |
|----------|--------|------|
| Triggers | `start` | Manual / chat / API entry |
| Triggers | `schedule` | Cron / interval trigger |
| Triggers | `webhook` | Inbound HTTP webhook trigger |
| AI | `agent` | Craft agent / LLM turn |
| AI | `generate-image` | Text-to-image |
| AI | `parameter-extractor` | LLM structured field extract |
| AI | `question-classifier` | LLM multi-way classify + route |
| AI | `text-splitter` | Chunk text for RAG pipelines |
| Flow | `condition` | Boolean branch |
| Flow | `switch` | Multi-case branch |
| Flow | `filter` | Pass / drop |
| Flow | `merge` | Join parallel branches |
| Flow | `loop` | For-each / while |
| Flow | `human-approval` | HITL approve / reject |
| Data | `variables` | Workflow-scoped vars |
| Data | `set-fields` | Write fields onto payload |
| Data | `template` | Text / JSON template |
| Data | `json` | Parse / stringify |
| Data | `transform` | Map / reshape payload |
| Data | `function` | Sandboxed JS snippet |
| Data | `batch` | Split arrays into chunks |
| Data | `aggregator` | Count / sum / avg / min / max / group by |
| Data | `csv` | Parse CSV ↔ JSON |
| Data | `sanitize` | Mask or remove sensitive fields |
| Action | `http` | Outbound HTTP |
| Action | `wait` | Delay |
| Action | `response` | Terminal structured reply |
| Action | `debug` | Log payload to debug / logs panel |
| Action | `subworkflow` | Invoke another workflow |

### Reference mapping (old Craft / z8run → Craft `type`)

| Old Craft `kind` / z8run `node_type` | Craft `type` | Notes |
|--------------------------------------|--------------|-------|
| `manual-trigger` | `start` | |
| `schedule-trigger` / `cron-trigger` / `timer` | `schedule` | |
| `webhook-trigger` / `webhook` / `http-in` | `webhook` | |
| `ai-agent` / `llm` / `ai-agent` | `agent` | |
| `generate-image` / `image-gen` | `generate-image` | |
| `parameter-extractor` / `structured-output` (partial) | `parameter-extractor` | |
| `question-classifier` / `classifier` | `question-classifier` | |
| `condition` / `if-else` | `condition` | |
| `switch` | `switch` | |
| `filter` | `filter` | |
| `merge` / `aggregator` (partial) | `merge` | Join branches, not numeric aggregate |
| `loop` | `loop` | |
| `human-approval` / `human-handoff` | `human-approval` | |
| `set-fields` / `mapper` (partial) | `set-fields` | |
| `template` / `prompt-template` | `template` | |
| `json` / `json-transform` | `json` | |
| `code` / `function` | `function` | |
| `http-request` / `http-request` | `http` | |
| `delay` / `delay` / `timer` (delay use) | `wait` | Single delay primitive |
| `output` / `http-out` / `response` | `response` | |
| `subworkflow` | `subworkflow` | |
| — / `mapper` (reshape) | `transform` | Already first-wave |
| — | `variables` | Workflow-scoped (vs payload `set-fields`) |
| — / `text-splitter` | `text-splitter` | |
| — / `batch` | `batch` | |
| — / `aggregator` (numeric) | `aggregator` | Distinct from `merge` (branch join) |
| — / `csv` | `csv` | Local transform only (no DB connector) |
| — / `sanitize` | `sanitize` | |
| — / `debug` | `debug` | Pass-through logger |

### Deferred (later)

Documented for discovery; **not** in the current registry:

| Source | Types deferred |
|--------|----------------|
| Old Craft data | `sort`, `limit` |
| Old Craft | `custom` (user modules / presets) |
| z8run AI / media | `embeddings`, `vector-store`, `tts`, `stt`, `summarizer`, `conversation-memory` |
| z8run integrations | `crm`, `mqtt`, `twilio`, `whatsapp`, `database` |
| z8run misc | `http-out` (as distinct from `response`) |
| Catalog | Any OAuth SaaS tool nodes (Airtable, Slack SDK, …) — use `http` + `agent` |

---

## 4. Field types (BlockConfig / Editor)

UI registry `fields[]` and documented config keys share these **editor field types** only:

| Field type | UI control | Config value shape |
|------------|------------|--------------------|
| `string` | single-line input | `string` |
| `textarea` | multi-line text | `string` |
| `number` | numeric input | `number` |
| `select` | dropdown | `string` (option id) |
| `switch` | boolean toggle | `boolean` |
| `cron` | cron expression editor | `string` (5-field cron) |
| `json` | JSON editor | object / array (parsed JSON) |

`BlockConfig` sketch (UI + docs; not a runtime import):

```ts
type FieldType = 'string' | 'textarea' | 'number' | 'select' | 'switch' | 'cron' | 'json'
type BlockCategory = 'triggers' | 'ai' | 'flow' | 'data' | 'action'

type BlockField = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: { id: string; label: string }[]
  default?: unknown
}

type BlockConfig = {
  type: NodeType
  category: BlockCategory
  label: string
  description: string
  accent: string
  handles: { target?: string[]; source: string[] }
  fields: BlockField[]
}
```

Toolbar sections mirror categories: **Triggers / AI / Flow / Data / Action**.

---

## 5. Config field tables (per `type`)

Defaults below are suggestions for create-from-palette; empty/`{}` is valid until the user edits.

### 5.1 Triggers

#### `start`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `inputSchema` | `json` | no | Optional structured inputs |

#### `schedule`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `cron` | `cron` | yes | e.g. `0 9 * * *` |
| `timezone` | `select` | no | IANA tz; default `UTC` |

#### `webhook`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `path` | `string` | yes | e.g. `/hooks/triage` |
| `method` | `select` | yes | `GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE`; default `POST` |
| `secret` | `string` | no | Optional shared secret / HMAC key |

### 5.2 AI

#### `agent`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `agent` | `string` | yes | Skill slug or agent label. Use `default` for the workspace default agent (no skill mention). Non-`default` values are passed as `[skill:…]` + `skillSlugs` on the Craft session. |
| `model` | `select` | no | `default` \| `fast` \| … (resolved by SessionManager) |
| `prompt` | `textarea` | no | Instruction for the turn (plus upstream JSON context) |
| `requireHitl` | `switch` | no | Inline HITL flag (prefer dedicated `human-approval` for branching) |

#### `generate-image`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `prompt` | `textarea` | yes | Image prompt |
| `model` | `select` | no | default `default` |
| `size` | `select` | no | `1024x1024` \| `1792x1024` \| `1024x1792` |

#### `parameter-extractor`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `source` | `string` | no | Expression; default `payload` |
| `instruction` | `textarea` | no | Extract instruction |
| `schema` | `json` | yes | Field defs `[{ key, type, … }]` |
| `model` | `select` | no | |

#### `question-classifier`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `source` | `string` | no | |
| `instruction` | `textarea` | no | |
| `categories` | `json` | yes | `[{ id, label }]` — `id` = `sourceHandle` |
| `model` | `select` | no | |

#### `text-splitter`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `source` | `string` | no | Expression; default `payload` |
| `strategy` | `select` | yes | `fixed` \| `separator` \| `paragraph` |
| `chunkSize` | `number` | no | Default `512` |
| `overlap` | `number` | no | Default `50` |
| `separator` | `string` | no | Used when `strategy` is `separator` |

### 5.3 Flow

#### `condition`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `expression` | `textarea` | yes | Boolean; edges `true` / `false` |

#### `switch`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `expression` | `textarea` | yes | Value to match |
| `cases` | `json` | yes | `[{ id, value }]` — `id` = `sourceHandle`; plus `default` |

#### `filter`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `expression` | `textarea` | yes | Edges `pass` / `drop` |

#### `merge`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `mode` | `select` | yes | `wait-all` \| `first` |

#### `loop`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `mode` | `select` | yes | `foreach` \| `while` |
| `items` | `string` | no | Array expression for foreach |
| `maxIterations` | `number` | no | Default `100`; edges `item` / `done` |

#### `human-approval`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `title` | `string` | yes | |
| `instruction` | `textarea` | no | |
| `timeoutMs` | `number` | no | Default 24h |
| `onTimeout` | `select` | no | `approved` \| `rejected` |

### 5.4 Data

#### `variables`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `assignments` | `json` | yes | `[{ name, value }]` |

#### `set-fields`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `fields` | `json` | yes | `[{ key, value }]` |
| `keepIncoming` | `switch` | no | Default `true` |

#### `template`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `template` | `textarea` | yes | |
| `outputMode` | `select` | no | `text` \| `json` |

#### `json`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `mode` | `select` | yes | `parse` \| `stringify` |
| `path` | `string` | no | Source path |
| `strict` | `switch` | no | Default `true` |

#### `transform`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `mapping` | `json` | yes | Output shape / map spec |
| `expression` | `textarea` | no | Optional alternative |

#### `function`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `code` | `textarea` | yes | JS function body |
| `timeoutMs` | `number` | no | |

#### `batch`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `field` | `string` | no | Array path; default `payload.items` |
| `size` | `number` | yes | Chunk size; default `100` |

#### `aggregator`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `operation` | `select` | yes | `count` \| `sum` \| `avg` \| `min` \| `max` |
| `field` | `string` | no | Value field |
| `groupBy` | `string` | no | Optional group key |

#### `csv`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `mode` | `select` | yes | `parse` \| `stringify` |
| `delimiter` | `string` | no | Default `,` |
| `hasHeaders` | `switch` | no | Default `true` |
| `path` | `string` | no | Source path |

#### `sanitize`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `fields` | `string` | no | Comma-separated field names |
| `strategy` | `select` | yes | `mask` \| `remove` \| `hash` |
| `detectPatterns` | `switch` | no | Default `true` |

### 5.5 Action

#### `http`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `url` | `string` | yes | Absolute URL |
| `method` | `select` | yes | HTTP methods |
| `headers` | `json` | no | |
| `body` | `json` | no | Ignored for GET |
| `timeoutMs` | `number` | no | Default `30000` |

#### `wait`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `duration` | `number` | yes | |
| `unit` | `select` | yes | `seconds` \| `minutes` \| `hours` \| `days` |

#### `response`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `status` | `number` | no | Default `200` |
| `body` | `json` | no | |
| `headers` | `json` | no | |

#### `debug`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `output` | `select` | no | `full` \| `keys` \| `summary` |
| `label` | `string` | no | Optional log label |
| `console` | `switch` | no | Also `console.log`; default `false` |

#### `subworkflow`

| Key | Field type | Required | Notes |
|-----|------------|----------|-------|
| `workflowId` | `string` | yes | Target workflow id |
| `input` | `json` | no | Input mapping |

---

## 6. HTTP API sketch

Base: craft-modules loopback (`X-Craft-Workspace-Id` as for RSS). Paths freeze here; status codes may refine at implementation.

| Method | Path | Purpose | Body / notes |
|--------|------|---------|--------------|
| GET | `/api/workflows` | List workflows | Prefer bare array for v1 |
| POST | `/api/workflows` | Create | Body: `{ name, description?, nodes?, edges? }` → `201` + `Workflow` |
| GET | `/api/workflows/:id` | Get one | `200` + `Workflow` / `404` |
| PATCH | `/api/workflows/:id` | Update | Partial: `{ name?, description?, nodes?, edges? }` → `200` + `Workflow` |
| DELETE | `/api/workflows/:id` | Delete | `204` / `404` |
| POST | `/api/workflows/:id/run` | Run (stub) | Returns `{ accepted: true, runId, steps?: RunStep[] }` — steps synthesized by `type`; **no real execution** |

`GET /health` modules list must include `"workflows"` once the package is mounted.

Node `type` in `definition_json` is **not** validated against an allowlist on create/update — unknown types round-trip; the UI registry is authoritative for the palette.

Persistence hint (Go): table `workflows (id, name, definition_json, updated_at)`.

### Run stub result shape

```ts
type RunStep = {
  id: string
  nodeId: string
  name: string
  nodeType: string
  status: 'success' | 'error' | 'running' | 'skipped'
  durationMs: number
  input: unknown
  output: unknown
  error?: string
}

type RunResult = {
  accepted: true
  runId?: string
  steps?: RunStep[]
}
```

---

## 7. MCP tools

Same MCP server as RSS (`craft-modules`); prefix `wf_`. Thin wrappers over HTTP.

| Tool | Maps to | Notes |
|------|---------|-------|
| `wf_list` | `GET /api/workflows` | |
| `wf_get` | `GET /api/workflows/:id` | Args: `id` |
| `wf_create` | `POST /api/workflows` | Args: name + optional graph |
| `wf_update` | `PATCH /api/workflows/:id` | Args: `id` + patch fields |
| `wf_delete` | `DELETE /api/workflows/:id` | Args: `id` |
| `wf_run` | `POST /api/workflows/:id/run` | Accept + stub steps in Go; Craft RPC path runs real agents |

---

## 8. Domain RPC

Channels under `RPC_CHANNELS.workflows.*` mirror HTTP (same pattern as `domain-rss`). UI hook: `use-workflow-data.ts`.

| RPC | HTTP |
|-----|------|
| `workflows:list` | `GET /api/workflows` |
| `workflows:get` | `GET /api/workflows/:id` |
| `workflows:create` | `POST /api/workflows` |
| `workflows:update` | `PATCH /api/workflows/:id` |
| `workflows:delete` | `DELETE /api/workflows/:id` |
| `workflows:run` | Go accept + Craft agent execution for `agent` nodes |
| `workflows:ping` | `/health` |

---

## 9. Out of scope

- Full graph executor for all ~23 node types (non-agent remain lightweight stubs)
- Cron/webhook runners, Deploy / Chat session wiring
- Embedding LLMs inside Go
- OAuth SaaS integration catalog
- Changing plan files

---

## 10. Decision summary

**Accepted:** Workflows share one JSON graph (`Workflow` + `Node.type` + `Edge`) between UI BlockConfig, Go SQLite, HTTP, and MCP. Phase 2.5 expands to ~23 primitive node types. **Run:** Go accepts; Craft executes `agent` steps via SessionManager and returns real Logs Output; other types stay stub/passthrough. Workbench UI uses `workflows:*` RPC.
