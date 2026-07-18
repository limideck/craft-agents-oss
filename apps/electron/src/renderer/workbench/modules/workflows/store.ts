import { atom } from 'jotai'
import { defaultConfigFor, getBlockConfig } from './blocks'
import type {
  WorkflowEdge,
  WorkflowLogLine,
  WorkflowNode,
  WorkflowNodeRunStatus,
  WorkflowNodeType,
  WorkflowRightTab,
  WorkflowRunStep,
  WorkflowSummary,
} from './mock/types'
import { wouldCreateCycle } from './utils/graph'

/** Workflow list — hydrated from RPC (empty until load). */
export const workflowsAtom = atom<WorkflowSummary[]>([])

/** Selected workflow in the activity list / canvas. */
export const selectedWorkflowIdAtom = atom<string | null>(null)

/** Selected canvas node — drives Editor tab. */
export const selectedNodeIdAtom = atom<string | null>(null)

/** Selected canvas edge (for Delete). */
export const selectedEdgeIdAtom = atom<string | null>(null)

/** Right panel internal tab (CSS hide/show; bodies stay mounted). */
export const workflowRightTabAtom = atom<WorkflowRightTab>('chat')

/** Run / deploy / persist log lines (session-local). */
export const workflowLogsAtom = atom<WorkflowLogLine[]>([])

/** Per-node steps from the last stub run (Logs panel Input/Output). */
export const workflowRunStepsAtom = atom<WorkflowRunStep[]>([])

/** Selected step in the Logs panel. */
export const selectedLogStepIdAtom = atom<string | null>(null)

/** Per-node run status rings (cleared on load / run stub). */
export const workflowNodeRunStatusAtom = atom<Record<string, WorkflowNodeRunStatus>>({})

export const workflowLoadingAtom = atom(true)

export const workflowErrorAtom = atom<string | null>(null)

/** MIME type for toolbar → canvas block drag. */
export const WORKFLOW_BLOCK_DND_MIME = 'application/grose-workflow-block'

let nodeSeq = 0
let edgeSeq = 0
let logSeq = 0

function touch(wf: WorkflowSummary): WorkflowSummary {
  return { ...wf, updatedAt: new Date().toISOString() }
}

/** Local draft shape for create — RPC assigns the authoritative id. */
export function createWorkflowDraft(name?: string): {
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
} {
  const stamp = Date.now()
  return {
    name: name?.trim() || 'Untitled workflow',
    description: undefined,
    nodes: [
      {
        id: `n-start-${stamp}`,
        type: 'start',
        name: 'Start',
        position: { x: 80, y: 100 },
        config: defaultConfigFor('start'),
      },
    ],
    edges: [],
  }
}

export function appendLogLine(
  logs: WorkflowLogLine[],
  message: string,
  level: WorkflowLogLine['level'] = 'info',
): WorkflowLogLine[] {
  logSeq += 1
  return [
    ...logs,
    {
      id: `log-${Date.now()}-${logSeq}`,
      ts: new Date().toISOString(),
      level,
      message,
    },
  ]
}

export function addNode(
  workflows: WorkflowSummary[],
  workflowId: string,
  type: WorkflowNodeType,
  position?: { x: number; y: number },
): { workflows: WorkflowSummary[]; nodeId: string } {
  nodeSeq += 1
  const block = getBlockConfig(type)
  const nodeId = `n-${type}-${Date.now()}-${nodeSeq}`
  const next = workflows.map((wf) => {
    if (wf.id !== workflowId) return wf
    const offset = wf.nodes.length
    const pos = position ?? {
      x: 64 + (offset % 4) * 180,
      y: 64 + Math.floor(offset / 4) * 110,
    }
    const node: WorkflowNode = {
      id: nodeId,
      type,
      name: block.label,
      position: pos,
      config: defaultConfigFor(type),
    }
    return touch({ ...wf, nodes: [...wf.nodes, node] })
  })
  return { workflows: next, nodeId }
}

/** @deprecated Use addNode */
export const addMockNode = addNode

export function updateNodePosition(
  workflows: WorkflowSummary[],
  workflowId: string,
  nodeId: string,
  position: { x: number; y: number },
): WorkflowSummary[] {
  return workflows.map((wf) => {
    if (wf.id !== workflowId) return wf
    return touch({
      ...wf,
      nodes: wf.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)),
    })
  })
}

export function updateNodeConfig(
  workflows: WorkflowSummary[],
  workflowId: string,
  nodeId: string,
  patch: { name?: string; config?: Record<string, unknown> },
): WorkflowSummary[] {
  return workflows.map((wf) => {
    if (wf.id !== workflowId) return wf
    return touch({
      ...wf,
      nodes: wf.nodes.map((n) => {
        if (n.id !== nodeId) return n
        return {
          ...n,
          name: patch.name ?? n.name,
          config: patch.config ? { ...n.config, ...patch.config } : n.config,
        }
      }),
    })
  })
}

export function connectNodes(
  workflows: WorkflowSummary[],
  workflowId: string,
  connection: {
    source: string
    target: string
    sourceHandle?: string | null
    targetHandle?: string | null
  },
): { workflows: WorkflowSummary[]; ok: boolean; reason?: string } {
  const wf = workflows.find((w) => w.id === workflowId)
  if (!wf) return { workflows, ok: false, reason: 'Workflow not found' }

  const sourceHandle = connection.sourceHandle ?? undefined
  const targetHandle = connection.targetHandle ?? undefined

  const duplicate = wf.edges.some(
    (e) =>
      e.source === connection.source &&
      e.target === connection.target &&
      (e.sourceHandle ?? undefined) === sourceHandle &&
      (e.targetHandle ?? undefined) === targetHandle,
  )
  if (duplicate) return { workflows, ok: false, reason: 'Edge already exists' }

  if (wouldCreateCycle(wf.edges, connection.source, connection.target)) {
    return { workflows, ok: false, reason: 'Connection would create a cycle' }
  }

  edgeSeq += 1
  const edge: WorkflowEdge = {
    id: `e-${Date.now()}-${edgeSeq}`,
    source: connection.source,
    target: connection.target,
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
  }

  const next = workflows.map((w) => {
    if (w.id !== workflowId) return w
    return touch({ ...w, edges: [...w.edges, edge] })
  })
  return { workflows: next, ok: true }
}

export function deleteNode(
  workflows: WorkflowSummary[],
  workflowId: string,
  nodeId: string,
): WorkflowSummary[] {
  return workflows.map((wf) => {
    if (wf.id !== workflowId) return wf
    return touch({
      ...wf,
      nodes: wf.nodes.filter((n) => n.id !== nodeId),
      edges: wf.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })
  })
}

export function deleteEdge(
  workflows: WorkflowSummary[],
  workflowId: string,
  edgeId: string,
): WorkflowSummary[] {
  return workflows.map((wf) => {
    if (wf.id !== workflowId) return wf
    return touch({
      ...wf,
      edges: wf.edges.filter((e) => e.id !== edgeId),
    })
  })
}
