import { RPC_CHANNELS } from '@grose-agent/shared/protocol'

/** Minimal server surface so domain packages do not depend on server-core. */
export type DomainRpcServer = {
  handle: (channel: string, handler: (...args: any[]) => any) => void
}

/**
 * Knowledge domain RPC registration (skeleton).
 * Business logic lands in Phase 3+; workspace data under:
 *   `{rootPath}/modules/knowledge/` (see docs/workspace-storage.md)
 */
export function registerKnowledgeRpcHandlers(server: DomainRpcServer): void {
  server.handle(RPC_CHANNELS.knowledge.PING, async () => ({
    ok: true as const,
    domain: 'knowledge' as const,
  }))
}
