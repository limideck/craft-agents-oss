import { useCallback, useEffect } from 'react'
import { getDefaultStore, useSetAtom } from 'jotai'
import type {
  GroseModulesWorkflow,
  GroseModulesWorkflowCreateInput,
} from '@grose-agent/shared/grose-modules'
import { useAppShellContext } from '@/context/AppShellContext'
import type { WorkflowSummary } from './mock/types'
import {
  appendLogLine,
  createWorkflowDraft,
  selectedLogStepIdAtom,
  selectedNodeIdAtom,
  selectedWorkflowIdAtom,
  workflowErrorAtom,
  workflowLoadingAtom,
  workflowLogsAtom,
  workflowNodeRunStatusAtom,
  workflowRunStepsAtom,
  workflowsAtom,
} from './store'

let refreshSeq = 0
let sharedRefresh: (() => Promise<void>) | null = null
let activeWorkspaceIdRef: string | null = null

const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()
const persistSeq = new Map<string, number>()

const PERSIST_DEBOUNCE_MS = 450

function toSummary(wf: GroseModulesWorkflow): WorkflowSummary {
  return {
    id: wf.id,
    name: wf.name,
    description: wf.description,
    updatedAt: wf.updatedAt,
    status: wf.status ?? 'draft',
    version: wf.version ?? 0,
    ...(wf.deployedAt ? { deployedAt: wf.deployedAt } : {}),
    nodes: wf.nodes.map((n) => ({
      id: n.id,
      type: n.type as WorkflowSummary['nodes'][number]['type'],
      name: n.name,
      position: n.position,
      config: n.config ?? {},
    })),
    edges: wf.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
    })),
  }
}

function hasWorkflowsApi(): boolean {
  return typeof window.electronAPI?.workflowsList === 'function'
}

/** Imperative refresh used after create / delete / failed persist recovery. */
export function refreshWorkflowData(): Promise<void> {
  return sharedRefresh?.() ?? Promise.resolve()
}

/**
 * Debounced PATCH of a workflow's graph to grose-modules.
 * Call after optimistic local mutations (nodes / edges / config / positions).
 */
export function scheduleWorkflowPersist(workflowId: string, delayMs = PERSIST_DEBOUNCE_MS): void {
  const existing = persistTimers.get(workflowId)
  if (existing) clearTimeout(existing)
  persistTimers.set(
    workflowId,
    setTimeout(() => {
      persistTimers.delete(workflowId)
      void flushWorkflowPersist(workflowId)
    }, delayMs),
  )
}

/** Flush pending persists (e.g. before Run so the sidecar has latest graph). */
export async function flushPendingWorkflowPersists(workflowId?: string): Promise<void> {
  const ids = workflowId
    ? [workflowId]
    : [...new Set([...persistTimers.keys(), ...persistSeq.keys()])]
  for (const id of ids) {
    const t = persistTimers.get(id)
    if (t) {
      clearTimeout(t)
      persistTimers.delete(id)
    }
  }
  await Promise.all(ids.map((id) => flushWorkflowPersist(id)))
}

async function flushWorkflowPersist(workflowId: string): Promise<void> {
  const workspaceId = activeWorkspaceIdRef
  if (!workspaceId || !hasWorkflowsApi()) return

  const jotai = getDefaultStore()
  const wf = jotai.get(workflowsAtom).find((w) => w.id === workflowId)
  if (!wf) return

  const seq = (persistSeq.get(workflowId) ?? 0) + 1
  persistSeq.set(workflowId, seq)

  try {
    const updated = await window.electronAPI.workflowsUpdate(workspaceId, workflowId, {
      name: wf.name,
      description: wf.description,
      nodes: wf.nodes,
      edges: wf.edges,
    })
    if (persistSeq.get(workflowId) !== seq) return
    jotai.set(workflowsAtom, (prev) =>
      prev.map((w) => (w.id === workflowId ? toSummary(updated) : w)),
    )
  } catch (err) {
    if (persistSeq.get(workflowId) !== seq) return
    const message = err instanceof Error ? err.message : String(err)
    jotai.set(workflowErrorAtom, message)
    jotai.set(workflowLogsAtom, (prev) =>
      appendLogLine(prev, `Persist failed: ${message}`, 'warn'),
    )
  }
}

export async function createWorkflowViaRpc(
  workspaceId: string,
  input?: Partial<GroseModulesWorkflowCreateInput> & { name?: string },
): Promise<WorkflowSummary> {
  const base = createWorkflowDraft(input?.name)
  const draft: GroseModulesWorkflowCreateInput = {
    name: base.name,
    description: input?.description ?? base.description,
    nodes: input?.nodes ?? base.nodes,
    edges: input?.edges ?? base.edges,
  }
  const created = await window.electronAPI.workflowsCreate(workspaceId, draft)
  return toSummary(created)
}

export async function deleteWorkflowViaRpc(
  workspaceId: string,
  workflowId: string,
): Promise<void> {
  const t = persistTimers.get(workflowId)
  if (t) {
    clearTimeout(t)
    persistTimers.delete(workflowId)
  }
  persistSeq.delete(workflowId)
  await window.electronAPI.workflowsDelete(workspaceId, workflowId)
}

export async function runWorkflowViaRpc(
  workspaceId: string,
  workflowId: string,
): Promise<import('@grose-agent/shared/grose-modules').GroseModulesWorkflowRunResult> {
  await flushPendingWorkflowPersists(workflowId)
  return window.electronAPI.workflowsRun(workspaceId, workflowId)
}

export async function deployWorkflowViaRpc(
  workspaceId: string,
  workflowId: string,
): Promise<import('@grose-agent/shared/grose-modules').GroseModulesWorkflowDeployResult> {
  await flushPendingWorkflowPersists(workflowId)
  return window.electronAPI.workflowsDeploy(workspaceId, workflowId)
}

type Options = {
  /** Only one surface should bootstrap (WorkflowListView). */
  bootstrap?: boolean
}

/** Load workflows for the active workspace from grose-modules via RPC. */
export function useWorkflowWorkspaceData(options: Options = {}) {
  const bootstrap = options.bootstrap ?? false
  const { activeWorkspaceId } = useAppShellContext()
  const setWorkflows = useSetAtom(workflowsAtom)
  const setLoading = useSetAtom(workflowLoadingAtom)
  const setError = useSetAtom(workflowErrorAtom)
  const setSelectedId = useSetAtom(selectedWorkflowIdAtom)
  const setSelectedNodeId = useSetAtom(selectedNodeIdAtom)
  const setRunStatus = useSetAtom(workflowNodeRunStatusAtom)
  const setRunSteps = useSetAtom(workflowRunStepsAtom)
  const setSelectedLogStepId = useSetAtom(selectedLogStepIdAtom)

  useEffect(() => {
    activeWorkspaceIdRef = activeWorkspaceId
  }, [activeWorkspaceId])

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId || !hasWorkflowsApi()) {
      setLoading(false)
      setError(activeWorkspaceId ? 'Workflows API unavailable' : 'No workspace')
      setWorkflows([])
      return
    }

    const seq = ++refreshSeq
    setLoading(true)
    setError(null)
    try {
      const items = await window.electronAPI.workflowsList(activeWorkspaceId)
      if (seq !== refreshSeq) return
      const summaries = items.map(toSummary)
      const prevId = getDefaultStore().get(selectedWorkflowIdAtom)
      const prevNodeId = getDefaultStore().get(selectedNodeIdAtom)
      const nextId =
        prevId && summaries.some((w) => w.id === prevId) ? prevId : (summaries[0]?.id ?? null)
      const nextWf = summaries.find((w) => w.id === nextId)
      const nextNodeId =
        prevNodeId && nextWf?.nodes.some((n) => n.id === prevNodeId)
          ? prevNodeId
          : (nextWf?.nodes[0]?.id ?? null)

      setWorkflows(summaries)
      setSelectedId(nextId)
      setSelectedNodeId(nextNodeId)
      setRunStatus({})
      setRunSteps([])
      setSelectedLogStepId(null)
    } catch (err) {
      if (seq !== refreshSeq) return
      setError(err instanceof Error ? err.message : String(err))
      setWorkflows([])
    } finally {
      if (seq === refreshSeq) setLoading(false)
    }
  }, [
    activeWorkspaceId,
    setWorkflows,
    setLoading,
    setError,
    setSelectedId,
    setSelectedNodeId,
    setRunStatus,
    setRunSteps,
    setSelectedLogStepId,
  ])

  useEffect(() => {
    sharedRefresh = refresh
    return () => {
      if (sharedRefresh === refresh) sharedRefresh = null
    }
  }, [refresh])

  useEffect(() => {
    if (!bootstrap) return
    void refresh()
  }, [bootstrap, refresh])

  return { refresh, workspaceId: activeWorkspaceId }
}
