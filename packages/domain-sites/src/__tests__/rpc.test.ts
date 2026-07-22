import { describe, it, expect } from 'bun:test'
import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import { registerSitesRpcHandlers, type DomainRpcServer } from '../index.ts'

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

describe('domain-sites RPC', () => {
  it('registers every sites channel', () => {
    const { server, handlers } = fakeServer()
    registerSitesRpcHandlers(server)
    const expected = Object.values(RPC_CHANNELS.sites).sort()
    expect([...handlers.keys()].sort()).toEqual(expected)
    for (const fn of handlers.values()) expect(typeof fn).toBe('function')
  })

  it('ping wraps the sidecar call (catch path returns ok:false without a sidecar)', async () => {
    const { server, handlers } = fakeServer()
    registerSitesRpcHandlers(server)
    const result = await handlers.get(RPC_CHANNELS.sites.PING)!()
    expect(result).toEqual({ ok: false, domain: 'sites' })
  })

  it('list forwards to the grose-modules client (rejects without a sidecar)', async () => {
    const { server, handlers } = fakeServer()
    registerSitesRpcHandlers(server)
    const list = handlers.get(RPC_CHANNELS.sites.LIST)!
    await expect(list(null, 'ws-1')).rejects.toBeDefined()
  })
})
