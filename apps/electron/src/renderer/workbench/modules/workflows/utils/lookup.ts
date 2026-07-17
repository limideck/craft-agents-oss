import type { WorkflowSummary } from '../mock/types'

export function getWorkflowById(
  workflows: WorkflowSummary[],
  id: string | null,
): WorkflowSummary | undefined {
  if (!id) return undefined
  return workflows.find((w) => w.id === id)
}

export function getNodeById(workflow: WorkflowSummary | undefined, nodeId: string | null) {
  if (!workflow || !nodeId) return undefined
  return workflow.nodes.find((n) => n.id === nodeId)
}
