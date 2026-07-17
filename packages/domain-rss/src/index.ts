import { RPC_CHANNELS } from '@craft-agent/shared/protocol'

/** Minimal server surface so domain packages do not depend on server-core. */
export type DomainRpcServer = {
  // Handler signature matches RpcServer.handle (ctx first); keep loose for stubs.
  handle: (channel: string, handler: (...args: any[]) => any) => void
}

/**
 * RSS domain RPC registration (skeleton).
 * Business logic lands in Phase 3+; workspace data under:
 *   ~/.craft-agent/workspaces/{id}/modules/rss/
 */
export function registerRssRpcHandlers(server: DomainRpcServer): void {
  server.handle(RPC_CHANNELS.rss.PING, async () => ({ ok: true as const, domain: 'rss' as const }))
}
