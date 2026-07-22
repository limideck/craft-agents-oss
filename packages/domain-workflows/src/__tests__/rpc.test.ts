import { describe, it, expect } from 'bun:test'
import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import { registerWorkflowsRpcHandlers, type DomainRpcServer } from '../index.ts'

/** Fake server that records every registered channel handler. */
function fakeServer() {
  const handlers = new Map<string, (...args: any[]) => any>()
  const server: DomainRpcServer = {
    handle: (channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler)
    },
  }
  return { server, handlers }
}

function registeredChannels(handlers: Map<string, unknown>): string[] {
  return [...handlers.keys()].sort()
}

describe('domain-workflows RPC', () => {
  it('registers every workflow channel (default: includes run)', () => {
    const { server, handlers } = fakeServer()
    registerWorkflowsRpcHandlers(server)
    // GET_HISTORY is registered by server-core's workflows-run handler, not by
    // the domain package, so it is excluded here. RUN is included by default.
    const expected = Object.values(RPC_CHANNELS.workflows)
      .filter((c) => c !== RPC_CHANNELS.workflows.GET_HISTORY)
      .sort()
    expect(registeredChannels(handlers)).toEqual(expected)
    for (const fn of handlers.values()) expect(typeof fn).toBe('function')
  })

  it('omits workflows:run when skipRun is set', () => {
    const { server, handlers } = fakeServer()
    registerWorkflowsRpcHandlers(server, { skipRun: true })
    expect(handlers.has(RPC_CHANNELS.workflows.RUN)).toBe(false)
    const expected = Object.values(RPC_CHANNELS.workflows)
      .filter((c) => c !== RPC_CHANNELS.workflows.RUN && c !== RPC_CHANNELS.workflows.GET_HISTORY)
      .sort()
    expect(registeredChannels(handlers)).toEqual(expected)
  })

  it('ping wraps the sidecar call (catch path returns ok:false without a sidecar)', async () => {
    const { server, handlers } = fakeServer()
    registerWorkflowsRpcHandlers(server)
    const result = await handlers.get(RPC_CHANNELS.workflows.PING)!()
    expect(result).toEqual({ ok: false, domain: 'workflows' })
  })

  it('list forwards to the grose-modules client (rejects without a sidecar)', async () => {
    const { server, handlers } = fakeServer()
    registerWorkflowsRpcHandlers(server)
    const list = handlers.get(RPC_CHANNELS.workflows.LIST)!
    // No sidecar in test env -> underlying grose-modules call rejects.
    await expect(list(null, 'ws-1')).rejects.toBeDefined()
  })
})
