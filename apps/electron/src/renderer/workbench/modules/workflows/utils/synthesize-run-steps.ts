import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowRunStep,
  WorkflowRunStepStatus,
} from '../mock/types'

const TRIGGER_TYPES = new Set<WorkflowNodeType>(['start', 'schedule', 'webhook'])

/** Topological / BFS order from triggers (or all roots), then any remaining nodes. */
export function linearizeNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  if (nodes.length === 0) return []

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  for (const n of nodes) {
    outgoing.set(n.id, [])
    indegree.set(n.id, 0)
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    outgoing.get(e.source)!.push(e.target)
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1)
  }

  const roots = nodes.filter(
    (n) => TRIGGER_TYPES.has(n.type) || (indegree.get(n.id) ?? 0) === 0,
  )
  const queue = roots.length > 0 ? [...roots] : [...nodes]
  const seen = new Set<string>()
  const ordered: WorkflowNode[] = []

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (seen.has(cur.id)) continue
    seen.add(cur.id)
    ordered.push(cur)
    for (const nextId of outgoing.get(cur.id) ?? []) {
      if (!seen.has(nextId)) {
        const next = byId.get(nextId)
        if (next) queue.push(next)
      }
    }
  }

  for (const n of nodes) {
    if (!seen.has(n.id)) ordered.push(n)
  }
  return ordered
}

function sampleDuration(type: WorkflowNodeType, index: number): number {
  const base: Record<WorkflowNodeType, number> = {
    start: 12,
    schedule: 8,
    webhook: 18,
    agent: 420,
    'generate-image': 900,
    'parameter-extractor': 280,
    'question-classifier': 260,
    'text-splitter': 35,
    condition: 6,
    switch: 8,
    filter: 7,
    merge: 10,
    loop: 40,
    'human-approval': 50,
    variables: 4,
    'set-fields': 5,
    template: 12,
    json: 9,
    transform: 22,
    function: 45,
    batch: 18,
    aggregator: 28,
    csv: 24,
    sanitize: 16,
    http: 180,
    wait: 25,
    response: 9,
    debug: 5,
    subworkflow: 60,
  }
  return (base[type] ?? 30) + (index % 5) * 3
}

function sampleInput(
  node: WorkflowNode,
  prevOutput: Record<string, unknown> | null,
): Record<string, unknown> {
  const incoming = prevOutput ?? { trigger: 'manual' }
  const cfg = node.config
  switch (node.type) {
    case 'start':
      return { trigger: 'manual', ...(cfg.inputSchema ? { schema: cfg.inputSchema } : {}) }
    case 'schedule':
      return { cron: cfg.cron ?? '0 9 * * *', timezone: cfg.timezone ?? 'UTC' }
    case 'webhook':
      return {
        path: cfg.path ?? '/hooks',
        method: cfg.method ?? 'POST',
        body: incoming,
      }
    case 'agent':
      return {
        agent: cfg.agent ?? 'default',
        model: cfg.model ?? 'default',
        prompt: cfg.prompt ?? null,
        context: incoming,
      }
    case 'generate-image':
      return {
        prompt: cfg.prompt ?? '',
        model: cfg.model ?? 'default',
        size: cfg.size ?? '1024x1024',
      }
    case 'parameter-extractor':
      return {
        source: cfg.source ?? 'payload',
        instruction: cfg.instruction ?? '',
        schema: cfg.schema ?? [],
        input: incoming,
      }
    case 'question-classifier':
      return {
        source: cfg.source ?? 'payload',
        categories: cfg.categories ?? [],
        input: incoming,
      }
    case 'text-splitter':
      return {
        source: cfg.source ?? 'payload',
        strategy: cfg.strategy ?? 'fixed',
        chunkSize: cfg.chunkSize ?? 512,
        overlap: cfg.overlap ?? 50,
        input: incoming,
      }
    case 'http':
      return {
        url: cfg.url ?? 'https://example.com',
        method: cfg.method ?? 'GET',
        headers: cfg.headers ?? {},
        body: cfg.body ?? incoming,
      }
    case 'function':
      return { code: typeof cfg.code === 'string' ? cfg.code.slice(0, 120) : '', input: incoming }
    case 'condition':
      return { expression: cfg.expression ?? 'true', input: incoming }
    case 'switch':
      return { expression: cfg.expression ?? '', cases: cfg.cases ?? [], input: incoming }
    case 'filter':
      return { expression: cfg.expression ?? 'true', input: incoming }
    case 'merge':
      return { mode: cfg.mode ?? 'wait-all', input: incoming }
    case 'loop':
      return {
        mode: cfg.mode ?? 'foreach',
        items: cfg.items ?? 'payload.items',
        maxIterations: cfg.maxIterations ?? 100,
        input: incoming,
      }
    case 'human-approval':
      return {
        title: cfg.title ?? 'Approval required',
        instruction: cfg.instruction ?? '',
        input: incoming,
      }
    case 'variables':
      return { assignments: cfg.assignments ?? [], input: incoming }
    case 'set-fields':
      return { fields: cfg.fields ?? [], keepIncoming: cfg.keepIncoming ?? true, input: incoming }
    case 'template':
      return { template: cfg.template ?? '', outputMode: cfg.outputMode ?? 'text', input: incoming }
    case 'json':
      return { mode: cfg.mode ?? 'parse', path: cfg.path ?? 'payload', input: incoming }
    case 'batch':
      return { field: cfg.field ?? 'payload.items', size: cfg.size ?? 100, input: incoming }
    case 'aggregator':
      return {
        operation: cfg.operation ?? 'count',
        field: cfg.field ?? '',
        groupBy: cfg.groupBy ?? '',
        input: incoming,
      }
    case 'csv':
      return {
        mode: cfg.mode ?? 'parse',
        delimiter: cfg.delimiter ?? ',',
        hasHeaders: cfg.hasHeaders ?? true,
        path: cfg.path ?? 'payload',
        input: incoming,
      }
    case 'sanitize':
      return {
        fields: cfg.fields ?? '',
        strategy: cfg.strategy ?? 'mask',
        detectPatterns: cfg.detectPatterns ?? true,
        input: incoming,
      }
    case 'wait':
      return { duration: cfg.duration ?? 1, unit: cfg.unit ?? 'seconds' }
    case 'response':
      return { status: cfg.status ?? 200, body: cfg.body ?? incoming }
    case 'debug':
      return {
        output: cfg.output ?? 'full',
        label: cfg.label ?? '',
        console: cfg.console ?? false,
        input: incoming,
      }
    case 'transform':
      return { mapping: cfg.mapping ?? {}, input: incoming }
    case 'subworkflow':
      return { workflowId: cfg.workflowId ?? '', input: cfg.input ?? incoming }
    default:
      return { config: cfg, input: incoming }
  }
}

function sampleOutput(
  node: WorkflowNode,
  input: Record<string, unknown>,
): Record<string, unknown> {
  switch (node.type) {
    case 'start':
      return { started: true, at: new Date().toISOString(), payload: {} }
    case 'schedule':
      return { fired: true, cron: input.cron }
    case 'webhook':
      return { received: true, path: input.path, status: 200 }
    case 'agent':
      return {
        text: `(local fallback) configure Agent + Run via Craft — not a model reply`,
        model: input.model,
        sessionId: null,
      }
    case 'generate-image':
      return {
        url: 'https://example.com/stub-image.png',
        size: input.size,
        model: input.model,
      }
    case 'parameter-extractor':
      return { extracted: {}, fields: input.schema ?? [] }
    case 'question-classifier':
      return { category: 'other', confidence: 0.72 }
    case 'text-splitter':
      return {
        chunks: ['(stub chunk 1)', '(stub chunk 2)'],
        count: 2,
        strategy: input.strategy,
      }
    case 'http':
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { ok: true, echo: input.body },
      }
    case 'function':
      return { result: null, logs: ['(stub) function executed'] }
    case 'condition':
      return { result: true, branch: 'true' }
    case 'switch':
      return { branch: 'case0', matched: true }
    case 'filter':
      return { branch: 'pass', matched: true }
    case 'merge':
      return { merged: true, mode: input.mode }
    case 'loop':
      return { iterations: 1, done: true }
    case 'human-approval':
      return { decision: 'approved', title: input.title }
    case 'variables':
      return { set: Array.isArray(input.assignments) ? input.assignments : [], vars: {} }
    case 'set-fields':
      return { fields: input.fields ?? [], payload: {} }
    case 'template':
      return { rendered: String(input.template ?? ''), mode: input.outputMode }
    case 'json':
      return { mode: input.mode, value: input.mode === 'stringify' ? '{}' : {} }
    case 'batch':
      return { batches: [[]], size: input.size ?? 100, count: 1 }
    case 'aggregator':
      return { operation: input.operation, value: 0, groups: {} }
    case 'csv':
      return {
        mode: input.mode,
        rows: input.mode === 'parse' ? [] : '',
        rowCount: 0,
      }
    case 'sanitize':
      return { strategy: input.strategy, redacted: 0, payload: input.input }
    case 'wait':
      return { waitedMs: Number(input.duration ?? 1) * 1000, unit: input.unit }
    case 'response':
      return {
        status: input.status ?? 200,
        body: input.body ?? { ok: true },
        headers: node.config.headers ?? {},
      }
    case 'debug':
      return {
        logged: true,
        label: input.label || null,
        shape: input.output,
        payload: input.input,
      }
    case 'transform':
      return { data: input.mapping ?? {}, mapped: true }
    case 'subworkflow':
      return { workflowId: input.workflowId, accepted: true, runId: 'stub-sub-run' }
    default:
      return { ok: true, type: node.type }
  }
}

let stepSeq = 0

/**
 * Build demonstrable per-node run steps from the current graph.
 * Not a real executor — sample input/output from node config / type.
 */
export function synthesizeRunSteps(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  opts?: { runId?: string },
): WorkflowRunStep[] {
  const ordered = linearizeNodes(nodes, edges)
  const runPrefix = opts?.runId ?? `local-${Date.now()}`
  let prev: Record<string, unknown> | null = null
  const steps: WorkflowRunStep[] = []

  ordered.forEach((node, index) => {
    stepSeq += 1
    const input = sampleInput(node, prev)
    const output = sampleOutput(node, input)
    const status: WorkflowRunStepStatus = 'success'
    steps.push({
      id: `step-${runPrefix}-${stepSeq}`,
      nodeId: node.id,
      name: node.name,
      nodeType: node.type,
      status,
      durationMs: sampleDuration(node.type, index),
      input,
      output,
    })
    prev = output
  })

  return steps
}

/** Map server step payload (if present) into local WorkflowRunStep[]. */
export function normalizeRunSteps(
  raw: unknown,
  fallbackNodes: WorkflowNode[],
  fallbackEdges: WorkflowEdge[],
  runId?: string,
): WorkflowRunStep[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return synthesizeRunSteps(fallbackNodes, fallbackEdges, { runId })
  }

  return raw.map((item, index) => {
    const s = item as Record<string, unknown>
    stepSeq += 1
    const nodeId = String(s.nodeId ?? s.node_id ?? `unknown-${index}`)
    const name = String(s.name ?? nodeId)
    const nodeType = String(s.nodeType ?? s.type ?? 'start')
    const statusRaw = String(s.status ?? 'success')
    const status: WorkflowRunStepStatus =
      statusRaw === 'error' || statusRaw === 'running' || statusRaw === 'skipped'
        ? statusRaw
        : 'success'
    return {
      id: String(s.id ?? `step-${runId ?? 'run'}-${stepSeq}`),
      nodeId,
      name,
      nodeType,
      status,
      durationMs: typeof s.durationMs === 'number' ? s.durationMs : Number(s.duration_ms ?? 0),
      input: s.input ?? {},
      output: s.output ?? {},
      ...(typeof s.error === 'string' && s.error ? { error: s.error } : {}),
    }
  })
}
