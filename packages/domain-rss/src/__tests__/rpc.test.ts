import { describe, it, expect } from 'bun:test'
import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import { registerRssRpcHandlers, type DomainRpcServer } from '../index.ts'

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

describe('domain-rss RPC', () => {
  it('registers every rss channel', () => {
    const { server, handlers } = fakeServer()
    registerRssRpcHandlers(server)
    const expected = Object.values(RPC_CHANNELS.rss).sort()
    expect([...handlers.keys()].sort()).toEqual(expected)
    for (const fn of handlers.values()) expect(typeof fn).toBe('function')
  })

  it('ping wraps the sidecar call (catch path returns ok:false without a sidecar)', async () => {
    const { server, handlers } = fakeServer()
    registerRssRpcHandlers(server)
    const result = await handlers.get(RPC_CHANNELS.rss.PING)!()
    expect(result).toEqual({ ok: false, domain: 'rss' })
  })

  it('listFeeds forwards to the grose-modules client (rejects without a sidecar)', async () => {
    const { server, handlers } = fakeServer()
    registerRssRpcHandlers(server)
    const listFeeds = handlers.get(RPC_CHANNELS.rss.LIST_FEEDS)!
    await expect(listFeeds(null, 'ws-1')).rejects.toBeDefined()
  })
})
