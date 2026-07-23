/**
 * Grose-side workflow run executor.
 *
 * Go (`grose-modules`) accepts the run and may synthesize stub steps for non-LLM
 * nodes. Agent / HITL steps are owned here: create a session, send the node
 * prompt, wait for the turn, and write real assistant text into the step output.
 */

import type {
  GroseModulesWorkflow,
  GroseModulesWorkflowEdge,
  GroseModulesWorkflowNode,
  GroseModulesWorkflowRunStep,
} from '@grose-agent/shared/grose-modules'
import type { PermissionMode } from '@grose-agent/shared/agent/mode-types'
import {
  runSilentAgentTurn,
  type SilentAgentHost,
} from '../sessions/silent-agent-turn'

const TRIGGER_TYPES = new Set(['start', 'schedule', 'webhook'])
const AUTONOMOUS_MODE: PermissionMode = 'allow-all'
/** Cap a single agent turn so a hung model cannot block Run forever. */
const AGENT_STEP_TIMEOUT_MS = 5 * 60_000

/** @deprecated Prefer SilentAgentHost — kept as a workflow-facing alias. */
export type WorkflowRunHost = SilentAgentHost

export type ExecuteWorkflowRunOptions = {
  workspaceId: string
  workflow: GroseModulesWorkflow
  runId: string
  host: WorkflowRunHost
  /** Optional override for tests. */
  agentTimeoutMs?: number
}

/** Topological / BFS order from triggers (or roots), then any remaining nodes. */
export function linearizeWorkflowNodes(
  nodes: GroseModulesWorkflowNode[],
  edges: GroseModulesWorkflowEdge[],
): GroseModulesWorkflowNode[] {
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
  const ordered: GroseModulesWorkflowNode[] = []

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

function sampleNonAgentInput(
  node: GroseModulesWorkflowNode,
  prev: Record<string, unknown> | null,
): Record<string, unknown> {
  const incoming = prev ?? { trigger: 'manual' }
  const cfg = node.config ?? {}
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
    default:
      return { config: cfg, input: incoming }
  }
}

function sampleNonAgentOutput(
  node: GroseModulesWorkflowNode,
  input: Record<string, unknown>,
): Record<string, unknown> {
  switch (node.type) {
    case 'start':
      return { started: true, at: new Date().toISOString(), payload: {} }
    case 'schedule':
      return { fired: true, cron: input.cron }
    case 'webhook':
      return { received: true, path: input.path, status: 200 }
    default:
      return { ok: true, type: node.type, passthrough: input.input ?? input }
  }
}

function buildAgentPrompt(
  prompt: unknown,
  context: Record<string, unknown> | null,
  agentRef: string,
): string {
  const instruction =
    typeof prompt === 'string' && prompt.trim().length > 0
      ? prompt.trim()
      : 'Continue based on the upstream workflow context.'

  const parts: string[] = []
  if (agentRef && agentRef !== 'default') {
    parts.push(`Apply this skill: [skill:${agentRef}]`)
    parts.push('')
  }
  parts.push(instruction)
  if (context && Object.keys(context).length > 0) {
    parts.push('')
    parts.push('Upstream workflow context (JSON):')
    parts.push('```json')
    parts.push(JSON.stringify(context, null, 2))
    parts.push('```')
  }
  return parts.join('\n')
}

async function runAgentStep(
  host: WorkflowRunHost,
  workspaceId: string,
  node: GroseModulesWorkflowNode,
  context: Record<string, unknown> | null,
  timeoutMs: number,
): Promise<{
  status: 'success' | 'error'
  input: Record<string, unknown>
  output: Record<string, unknown>
  error?: string
  durationMs: number
}> {
  const started = Date.now()
  const cfg = node.config ?? {}
  const agentRef = typeof cfg.agent === 'string' ? cfg.agent.trim() : ''
  const modelRaw = typeof cfg.model === 'string' ? cfg.model : 'default'
  const model = modelRaw && modelRaw !== 'default' ? modelRaw : undefined

  const input: Record<string, unknown> = {
    agent: agentRef || null,
    model: modelRaw || 'default',
    prompt: typeof cfg.prompt === 'string' ? cfg.prompt : null,
    context: context ?? { trigger: 'manual' },
  }

  if (!agentRef) {
    return {
      status: 'error',
      input,
      output: {},
      error: 'Agent node requires config.agent (skill slug or agent label)',
      durationMs: Date.now() - started,
    }
  }

  const prompt = buildAgentPrompt(cfg.prompt, context, agentRef)
  let sessionId: string | undefined

  try {
    const skillSlugs = agentRef && agentRef !== 'default' ? [agentRef] : undefined
    const { sessionId: sid, text: finalText } = await runSilentAgentTurn({
      host,
      workspaceId,
      prompt,
      timeoutMs,
      sessionName: `Workflow · ${node.name}`,
      sessionOptions: {
        permissionMode: AUTONOMOUS_MODE,
        systemPromptPreset: 'mini',
        ...(model ? { model } : {}),
      },
      sendOptions: skillSlugs ? { skillSlugs } : undefined,
    })
    sessionId = sid
    const text = finalText.trim()
    if (!text) {
      return {
        status: 'error',
        input: { ...input, sessionId },
        output: { text: '', model: modelRaw, sessionId, agent: agentRef },
        error: 'Agent completed without producing a reply',
        durationMs: Date.now() - started,
      }
    }

    return {
      status: 'success',
      input: { ...input, sessionId },
      output: {
        text,
        model: modelRaw,
        sessionId,
        agent: agentRef,
      },
      durationMs: Date.now() - started,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'error',
      input: sessionId ? { ...input, sessionId } : input,
      output: {},
      error: message,
      durationMs: Date.now() - started,
    }
  }
}

/**
 * Execute a workflow graph: real Grose agent sessions for `agent` nodes;
 * lightweight stub/passthrough I/O for everything else (v1).
 */
export async function executeWorkflowRun(
  opts: ExecuteWorkflowRunOptions,
): Promise<GroseModulesWorkflowRunStep[]> {
  const { workspaceId, workflow, runId, host } = opts
  const timeoutMs = opts.agentTimeoutMs ?? AGENT_STEP_TIMEOUT_MS
  const ordered = linearizeWorkflowNodes(workflow.nodes, workflow.edges)
  const steps: GroseModulesWorkflowRunStep[] = []
  let prev: Record<string, unknown> | null = null

  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i]!
    const stepId = `step-${runId}-${i + 1}`

    if (node.type === 'agent') {
      const result = await runAgentStep(host, workspaceId, node, prev, timeoutMs)
      steps.push({
        id: stepId,
        nodeId: node.id,
        name: node.name,
        nodeType: node.type,
        status: result.status,
        durationMs: result.durationMs,
        input: result.input,
        output: result.output,
        ...(result.error ? { error: result.error } : {}),
      })
      if (result.status === 'error') {
        // Stop the linear chain on agent failure so downstream stubs don't look successful.
        prev = null
        for (let j = i + 1; j < ordered.length; j++) {
          const skipped = ordered[j]!
          steps.push({
            id: `step-${runId}-${j + 1}`,
            nodeId: skipped.id,
            name: skipped.name,
            nodeType: skipped.type,
            status: 'skipped',
            durationMs: 0,
            input: {},
            output: {},
            error: 'Skipped after upstream agent error',
          })
        }
        break
      }
      prev = result.output
      continue
    }

    const input = sampleNonAgentInput(node, prev)
    const output = sampleNonAgentOutput(node, input)
    steps.push({
      id: stepId,
      nodeId: node.id,
      name: node.name,
      nodeType: node.type,
      status: 'success',
      durationMs: 8 + (i % 5) * 3,
      input,
      output,
    })
    prev = output
  }

  return steps
}
