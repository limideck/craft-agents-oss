/**
 * Domain stub RPC mount points (Phase 2).
 * Delegates to domain packages; no business logic here.
 */

import type { RpcServer } from '@craft-agent/server-core/transport'
import { registerRssRpcHandlers } from '@craft-agent/domain-rss'
import { registerKnowledgeRpcHandlers } from '@craft-agent/domain-knowledge'
import { registerWorkflowsRpcHandlers } from '@craft-agent/domain-workflows'

export function registerDomainStubHandlers(server: RpcServer): void {
  registerRssRpcHandlers(server)
  registerKnowledgeRpcHandlers(server)
  registerWorkflowsRpcHandlers(server)
}
