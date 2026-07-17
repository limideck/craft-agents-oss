import { RPC_CHANNELS } from '@craft-agent/shared/protocol'

/** Minimal server surface so domain packages do not depend on server-core. */
export type DomainRpcServer = {
  handle: (channel: string, handler: (...args: any[]) => any) => void
}

/**
 * Workflows domain RPC registration (skeleton).
 * Business logic lands in Phase 3+; workspace data under:
 *   ~/.craft-agent/workspaces/{id}/modules/workflows/
 */
export function registerWorkflowsRpcHandlers(server: DomainRpcServer): void {
  server.handle(RPC_CHANNELS.workflows.PING, async () => ({
    ok: true as const,
    domain: 'workflows' as const,
  }))
}
