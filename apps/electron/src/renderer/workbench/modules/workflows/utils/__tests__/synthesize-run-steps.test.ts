import { describe, expect, test } from 'bun:test'
import type { WorkflowEdge, WorkflowNode } from '../../mock/types'
import { linearizeNodes, synthesizeRunSteps } from '../synthesize-run-steps'

const nodes: WorkflowNode[] = [
  {
    id: 'n-start',
    type: 'start',
    name: 'Start',
    position: { x: 0, y: 0 },
    config: {},
  },
  {
    id: 'n-agent',
    type: 'agent',
    name: 'Summarize',
    position: { x: 200, y: 0 },
    config: { agent: 'inbox-helper', model: 'default' },
  },
  {
    id: 'n-end',
    type: 'response',
    name: 'Done',
    position: { x: 400, y: 0 },
    config: { status: 200 },
  },
]

const edges: WorkflowEdge[] = [
  { id: 'e1', source: 'n-start', target: 'n-agent' },
  { id: 'e2', source: 'n-agent', target: 'n-end' },
]

describe('linearizeNodes', () => {
  test('orders from trigger along edges', () => {
    const ordered = linearizeNodes(nodes, edges)
    expect(ordered.map((n) => n.id)).toEqual(['n-start', 'n-agent', 'n-end'])
  })
})

describe('synthesizeRunSteps', () => {
  test('builds input/output per node', () => {
    const steps = synthesizeRunSteps(nodes, edges, { runId: 'r1' })
    expect(steps).toHaveLength(3)
    expect(steps[0]!.nodeId).toBe('n-start')
    expect(steps[0]!.status).toBe('success')
    expect(steps[0]!.input).toBeTruthy()
    expect(steps[0]!.output).toBeTruthy()
    expect(steps[1]!.name).toBe('Summarize')
    expect(typeof steps[1]!.durationMs).toBe('number')
    expect(steps[2]!.nodeType).toBe('response')
  })
})
