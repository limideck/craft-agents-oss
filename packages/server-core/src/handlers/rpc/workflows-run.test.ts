import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RPC_CHANNELS } from '@grose-agent/shared/protocol'

const handlers: Record<string, (ctx: unknown, ...args: unknown[]) => Promise<unknown>> = {}

const fakeServer = {
  handle(channel: string, fn: (ctx: unknown, ...args: unknown[]) => Promise<unknown>) {
    handlers[channel] = fn
    return fakeServer
  },
} as unknown as import('@grose-agent/server-core/transport').RpcServer

const deps = {
  sessionManager: {} as unknown,
  platform: {} as unknown,
  oauthFlowStore: {} as unknown,
}

let tmpRoot = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wf-run-'))
  for (const k of Object.keys(handlers)) delete handlers[k]
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

function registerWithMocks(opts: { steps?: unknown[]; fail?: boolean }) {
  mock.module('@grose-agent/shared/config', () => ({
    getWorkspaceByNameOrId: (_id: string) => ({ id: 'ws-1', rootPath: tmpRoot }),
  }))
  mock.module('@grose-agent/shared/grose-modules', () => ({
    getWorkflow: async (_ws: string, _id: string) => ({ id: 'wf-1', name: 'Flow' }),
    runWorkflow: async () => ({ runId: 'run-1' }),
  }))
  mock.module('../../workflows/execute-workflow-run', () => ({
    executeWorkflowRun: async () => {
      if (opts.fail) throw new Error('boom')
      return opts.steps ?? [{ id: 's1' }, { id: 's2' }]
    },
  }))
  return import('./workflows-run.ts').then((m) => {
    m.registerWorkflowsRunHandler(fakeServer, deps as never)
    return m
  })
}

function readHistoryLines() {
  const p = join(tmpRoot, 'automations-history.jsonl')
  if (!existsSync(p)) return []
  return readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean)
}

describe('workflows:run history write', () => {
  it('appends a flow history entry on success', async () => {
    await registerWithMocks({ steps: [{ id: 's1' }, { id: 's2' }] })
    const run = handlers[RPC_CHANNELS.workflows.RUN]!
    await run(null, 'ws-1', 'wf-1')

    const lines = readHistoryLines()
    expect(lines).toHaveLength(1)
    const entry = JSON.parse(lines[0]!)
    expect(entry).toMatchObject({ kind: 'flow', id: 'wf-1', runId: 'run-1', ok: true, stepCount: 2 })
    expect(typeof entry.ts).toBe('number')
  })

  it('appends a failed flow history entry on error', async () => {
    await registerWithMocks({ fail: true })
    const run = handlers[RPC_CHANNELS.workflows.RUN]!
    await expect(run(null, 'ws-1', 'wf-1')).rejects.toThrow('boom')

    const lines = readHistoryLines()
    const entry = JSON.parse(lines[0]!)
    expect(entry).toMatchObject({ kind: 'flow', id: 'wf-1', runId: 'run-1', ok: false, error: 'boom' })
  })
})

describe('workflows:getHistory', () => {
  it('returns flow entries for the workflow, newest first', async () => {
    await registerWithMocks({ steps: [{ id: 's1' }] })
    const run = handlers[RPC_CHANNELS.workflows.RUN]!
    await run(null, 'ws-1', 'wf-1')

    const getHistory = handlers[RPC_CHANNELS.workflows.GET_HISTORY]!
    const result = (await getHistory(null, 'ws-1', 'wf-1')) as Array<{ kind: string; id: string; runId: string; ok: boolean }>
    expect(result).toHaveLength(1)
    expect(result[0]!.kind).toBe('flow')
    expect(result[0]!.id).toBe('wf-1')
    expect(result[0]!.ok).toBe(true)
  })

  it('does not return entries for a different workflow id', async () => {
    await registerWithMocks({ steps: [{ id: 's1' }] })
    const run = handlers[RPC_CHANNELS.workflows.RUN]!
    await run(null, 'ws-1', 'wf-1')

    const getHistory = handlers[RPC_CHANNELS.workflows.GET_HISTORY]!
    const result = (await getHistory(null, 'ws-1', 'other-wf')) as unknown[]
    expect(result).toHaveLength(0)
  })
})
