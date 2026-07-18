import { describe, expect, it } from 'bun:test'
import type { GroseModulesWorkflow } from '@grose-agent/shared/grose-modules'
import type { SessionCompletionEvent } from '../sessions/SessionManager'
import {
  executeWorkflowRun,
  linearizeWorkflowNodes,
  type WorkflowRunHost,
} from './execute-workflow-run'

function makeHost(opts?: {
  finalText?: string
  failSend?: boolean
  completeReason?: SessionCompletionEvent['reason']
}): WorkflowRunHost & {
  created: { workspaceId: string; options: Record<string, unknown> }[]
  sent: { sessionId: string; message: string; skillSlugs?: string[] }[]
} {
  const listeners = new Set<(evt: SessionCompletionEvent) => void>()
  const created: { workspaceId: string; options: Record<string, unknown> }[] = []
  const sent: { sessionId: string; message: string; skillSlugs?: string[] }[] = []
  let seq = 0

  return {
    created,
    sent,
    async createSession(workspaceId, options) {
      seq += 1
      const id = `sess-${seq}`
      created.push({ workspaceId, options: { ...(options ?? {}) } })
      return { id }
    },
    async sendMessage(sessionId, message, _a, _b, options) {
      sent.push({ sessionId, message, skillSlugs: options?.skillSlugs })
      if (opts?.failSend) throw new Error('send failed')
      // Simulate turn completion after send (mirrors SessionManager).
      queueMicrotask(() => {
        for (const l of listeners) {
          l({
            sessionId,
            workspaceId: 'ws-1',
            reason: opts?.completeReason ?? 'complete',
            finalText: opts?.finalText ?? 'Why did the chicken cross the road?',
          })
        }
      })
    },
    onSessionComplete(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSessionFinalText(sessionId) {
      void sessionId
      return opts?.finalText ?? 'Why did the chicken cross the road?'
    },
  }
}

const startAgentWorkflow = (): GroseModulesWorkflow => ({
  id: 'wf-1',
  name: 'Joke',
  updatedAt: new Date().toISOString(),
  nodes: [
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
      name: 'Agent',
      position: { x: 200, y: 0 },
      config: {
        agent: 'default',
        model: 'default',
        prompt: '给我讲一下笑话',
      },
    },
  ],
  edges: [{ id: 'e1', source: 'n-start', target: 'n-agent' }],
})

describe('linearizeWorkflowNodes', () => {
  it('orders start before agent along the edge', () => {
    const wf = startAgentWorkflow()
    const ordered = linearizeWorkflowNodes(wf.nodes, wf.edges)
    expect(ordered.map((n) => n.id)).toEqual(['n-start', 'n-agent'])
  })
})

describe('executeWorkflowRun', () => {
  it('runs a real agent step and returns model text (not a stub)', async () => {
    const host = makeHost({ finalText: '真实笑话：程序员最怕的是 null。' })
    const steps = await executeWorkflowRun({
      workspaceId: 'ws-1',
      workflow: startAgentWorkflow(),
      runId: 'run-1',
      host,
    })

    expect(steps).toHaveLength(2)
    expect(steps[0]!.nodeType).toBe('start')
    expect(steps[0]!.status).toBe('success')

    const agent = steps[1]!
    expect(agent.nodeType).toBe('agent')
    expect(agent.status).toBe('success')
    expect(agent.output).toMatchObject({
      text: '真实笑话：程序员最怕的是 null。',
      agent: 'default',
      sessionId: 'sess-1',
    })
    expect(String((agent.output as { text: string }).text)).not.toContain('Stub reply')
    expect(host.created).toHaveLength(1)
    expect(host.created[0]!.options.permissionMode).toBe('allow-all')
    expect(host.created[0]!.options.systemPromptPreset).toBe('mini')
    expect(host.sent[0]!.message).toContain('给我讲一下笑话')
  })

  it('errors when agent reference is missing', async () => {
    const host = makeHost()
    const wf = startAgentWorkflow()
    wf.nodes[1]!.config = { prompt: 'hi', model: 'default', agent: '' }

    const steps = await executeWorkflowRun({
      workspaceId: 'ws-1',
      workflow: wf,
      runId: 'run-2',
      host,
    })

    expect(steps[1]!.status).toBe('error')
    expect(steps[1]!.error).toMatch(/requires config\.agent/)
    expect(host.created).toHaveLength(0)
  })

  it('passes skill slug for non-default agent refs', async () => {
    const host = makeHost({ finalText: 'ok' })
    const wf = startAgentWorkflow()
    wf.nodes[1]!.config = { agent: 'joke-teller', prompt: 'tell a joke', model: 'fast' }

    await executeWorkflowRun({
      workspaceId: 'ws-1',
      workflow: wf,
      runId: 'run-3',
      host,
    })

    expect(host.created[0]!.options.model).toBe('fast')
    expect(host.sent[0]!.skillSlugs).toEqual(['joke-teller'])
    expect(host.sent[0]!.message).toContain('[skill:joke-teller]')
  })

  it('marks agent step error when send fails', async () => {
    const host = makeHost({ failSend: true })
    const steps = await executeWorkflowRun({
      workspaceId: 'ws-1',
      workflow: startAgentWorkflow(),
      runId: 'run-4',
      host,
    })
    expect(steps[1]!.status).toBe('error')
    expect(steps[1]!.error).toBe('send failed')
  })
})
