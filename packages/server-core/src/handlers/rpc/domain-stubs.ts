/**
 * Domain RPC mount points.
 * Delegates to domain packages; RSS proxies to craft-modules.
 * Workflows CRUD is proxied; `workflows:run` is registered by workflows-run.ts
 * (Craft executes agent nodes via SessionManager).
 */

import type { RpcServer } from '@craft-agent/server-core/transport'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { registerRssRpcHandlers } from '@craft-agent/domain-rss'
import { registerKnowledgeRpcHandlers } from '@craft-agent/domain-knowledge'
import { registerWorkflowsRpcHandlers } from '@craft-agent/domain-workflows'
import type { HandlerDeps } from '../handler-deps'
import { registerWorkflowsRunHandler } from './workflows-run'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.rss.PING,
  RPC_CHANNELS.rss.LIST_FEEDS,
  RPC_CHANNELS.rss.ADD_FEED,
  RPC_CHANNELS.rss.RENAME_FEED,
  RPC_CHANNELS.rss.DELETE_FEED,
  RPC_CHANNELS.rss.IMPORT_OPML,
  RPC_CHANNELS.rss.EXPORT_OPML,
  RPC_CHANNELS.rss.LIST_ARTICLES,
  RPC_CHANNELS.rss.GET_ARTICLE,
  RPC_CHANNELS.rss.FETCH_ARTICLE_CONTENT,
  RPC_CHANNELS.rss.TOGGLE_STAR,
  RPC_CHANNELS.rss.STARRED_COUNT,
  RPC_CHANNELS.rss.REFRESH,
  RPC_CHANNELS.rss.GET_SETTINGS,
  RPC_CHANNELS.rss.PATCH_SETTINGS,
  RPC_CHANNELS.knowledge.PING,
  RPC_CHANNELS.workflows.PING,
  RPC_CHANNELS.workflows.LIST,
  RPC_CHANNELS.workflows.GET,
  RPC_CHANNELS.workflows.CREATE,
  RPC_CHANNELS.workflows.UPDATE,
  RPC_CHANNELS.workflows.DELETE,
  RPC_CHANNELS.workflows.RUN,
  RPC_CHANNELS.workflows.DEPLOY,
  RPC_CHANNELS.workflows.UNDEPLOY,
] as const

export function registerDomainStubHandlers(server: RpcServer, deps: HandlerDeps): void {
  registerRssRpcHandlers(server)
  registerKnowledgeRpcHandlers(server)
  registerWorkflowsRpcHandlers(server, { skipRun: true })
  registerWorkflowsRunHandler(server, deps)
}
