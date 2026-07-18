/**
 * Domain RPC mount points.
 * Delegates to domain packages; RSS proxies to grose-modules.
 * Workflows CRUD is proxied; `workflows:run` is registered by workflows-run.ts
 * (Grose executes agent nodes via SessionManager).
 */

import type { RpcServer } from '@grose-agent/server-core/transport'
import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import { registerRssRpcHandlers } from '@grose-agent/domain-rss'
import { registerKnowledgeRpcHandlers } from '@grose-agent/domain-knowledge'
import { registerWorkflowsRpcHandlers } from '@grose-agent/domain-workflows'
import { registerSitesRpcHandlers } from '@grose-agent/domain-sites'
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
  RPC_CHANNELS.sites.PING,
  RPC_CHANNELS.sites.LIST,
  RPC_CHANNELS.sites.GET,
  RPC_CHANNELS.sites.CREATE,
  RPC_CHANNELS.sites.DELETE,
  RPC_CHANNELS.sites.UPDATE,
  RPC_CHANNELS.sites.LIST_FILES,
  RPC_CHANNELS.sites.READ_FILE,
  RPC_CHANNELS.sites.WRITE_FILE,
  RPC_CHANNELS.sites.PREVIEW_START,
  RPC_CHANNELS.sites.PREVIEW_STOP,
  RPC_CHANNELS.sites.PREVIEW_URL,
  RPC_CHANNELS.sites.VISUAL_EDIT_SAVE,
  RPC_CHANNELS.sites.BIND_SESSION,
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
  registerSitesRpcHandlers(server)
  registerWorkflowsRpcHandlers(server, { skipRun: true })
  registerWorkflowsRunHandler(server, deps)
}
