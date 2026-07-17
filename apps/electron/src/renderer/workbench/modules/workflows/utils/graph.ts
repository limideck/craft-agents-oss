import type { WorkflowEdge } from '../mock/types'

/**
 * Returns true if adding an edge from `source` → `target` would create a cycle.
 */
export function wouldCreateCycle(
  edges: WorkflowEdge[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true

  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const list = adj.get(e.source)
    if (list) list.push(e.target)
    else adj.set(e.source, [e.target])
  }

  const stack = [target]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (cur === source) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    const next = adj.get(cur)
    if (next) {
      for (const n of next) stack.push(n)
    }
  }
  return false
}
