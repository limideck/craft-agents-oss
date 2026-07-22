import { describe, it, expect } from 'bun:test'
import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import { registerKnowledgeRpcHandlers, type DomainRpcServer } from '../index.ts'

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

describe('domain-knowledge RPC', () => {
  it('registers the knowledge channel', () => {
    const { server, handlers } = fakeServer()
    registerKnowledgeRpcHandlers(server)
    const expected = Object.values(RPC_CHANNELS.knowledge).sort()
    expect([...handlers.keys()].sort()).toEqual(expected)
    for (const fn of handlers.values()) expect(typeof fn).toBe('function')
  })

  it('ping returns ok (skeleton handler, no sidecar dependency)', async () => {
    const { server, handlers } = fakeServer()
    registerKnowledgeRpcHandlers(server)
    const result = await handlers.get(RPC_CHANNELS.knowledge.PING)!()
    expect(result).toEqual({ ok: true, domain: 'knowledge' })
  })
})
