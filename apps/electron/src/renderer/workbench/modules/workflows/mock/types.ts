/** Workflow editor types — aligned with docs/workbench-workflows-contract.md. */

export type WorkflowNodeType =
  // Triggers
  | 'start'
  | 'schedule'
  | 'webhook'
  // AI
  | 'agent'
  | 'generate-image'
  | 'parameter-extractor'
  | 'question-classifier'
  | 'text-splitter'
  // Flow
  | 'condition'
  | 'switch'
  | 'filter'
  | 'merge'
  | 'loop'
  | 'human-approval'
  // Data
  | 'variables'
  | 'set-fields'
  | 'template'
  | 'json'
  | 'transform'
  | 'function'
  | 'batch'
  | 'aggregator'
  | 'csv'
  | 'sanitize'
  // Action
  | 'http'
  | 'wait'
  | 'response'
  | 'debug'
  | 'subworkflow'

export type WorkflowNode = {
  id: string
  /** Discriminator — see contract §3. Not `kind`. */
  type: WorkflowNodeType
  /** Display title on the canvas. */
  name: string
  position: { x: number; y: number }
  /** Keys depend on `type` — JSON-serializable. */
  config: Record<string, unknown>
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  /** Default single output handle is `"source"` when omitted. */
  sourceHandle?: string
  /** Default single input handle is `"target"` when omitted. */
  targetHandle?: string
}

export type WorkflowSummary = {
  id: string
  name: string
  description?: string
  /** ISO-8601 updated timestamp. */
  updatedAt: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  /** draft until Deploy publishes a live snapshot. */
  status: 'draft' | 'deployed'
  /** deployed_version; 0 if never deployed. */
  version: number
  /** ISO-8601 when last deployed. */
  deployedAt?: string
}

export type WorkflowRightTab = 'chat' | 'toolbar' | 'editor'

export type WorkflowLogLevel = 'info' | 'success' | 'warn'

/** Session-local status lines (deploy / persist / add-block). */
export type WorkflowLogLine = {
  id: string
  ts: string
  level: WorkflowLogLevel
  message: string
}

/** Per-node step from a (stub) run — Input/Output detail in Logs panel. */
export type WorkflowRunStepStatus = 'success' | 'error' | 'running' | 'skipped'

export type WorkflowRunStep = {
  id: string
  nodeId: string
  name: string
  nodeType: WorkflowNodeType | string
  status: WorkflowRunStepStatus
  durationMs: number
  input: unknown
  output: unknown
  error?: string
}

/** Stub run visual state per node (local mock only). */
export type WorkflowNodeRunStatus = 'idle' | 'running' | 'success' | 'error'
