import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import * as rss from '@craft-agent/shared/craft-modules'
import type {
  CraftModulesRssArticle,
  CraftModulesRssListMode,
  CraftModulesRssView,
} from '@craft-agent/shared/craft-modules'

/** Minimal server surface so domain packages do not depend on server-core. */
export type DomainRpcServer = {
  handle: (channel: string, handler: (...args: any[]) => any) => void
}

/**
 * RSS domain RPC — thin proxy to craft-modules Go sidecar.
 * Workspace data: ~/.craft-agent/workspaces/{id}/modules/rss/
 */
export function registerRssRpcHandlers(server: DomainRpcServer): void {
  server.handle(RPC_CHANNELS.rss.PING, async () => {
    try {
      return await rss.rssPing()
    } catch {
      return { ok: false as const, domain: 'rss' as const }
    }
  })

  server.handle(RPC_CHANNELS.rss.LIST_FEEDS, async (_ctx: unknown, workspaceId: string) => {
    return rss.listFeeds(workspaceId)
  })

  server.handle(
    RPC_CHANNELS.rss.ADD_FEED,
    async (_ctx: unknown, workspaceId: string, input: { url: string; name?: string }) => {
      return rss.addFeed(workspaceId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.rss.RENAME_FEED,
    async (_ctx: unknown, workspaceId: string, feedId: string, name: string) => {
      return rss.renameFeed(workspaceId, feedId, name)
    },
  )

  server.handle(
    RPC_CHANNELS.rss.DELETE_FEED,
    async (_ctx: unknown, workspaceId: string, feedId: string) => {
      return rss.deleteFeed(workspaceId, feedId)
    },
  )

  server.handle(
    RPC_CHANNELS.rss.IMPORT_OPML,
    async (_ctx: unknown, workspaceId: string, opml: string) => {
      return rss.importOpml(workspaceId, opml)
    },
  )

  server.handle(
    RPC_CHANNELS.rss.LIST_ARTICLES,
    async (
      _ctx: unknown,
      workspaceId: string,
      input?: {
        view?: CraftModulesRssView
        feedId?: string
        mode?: CraftModulesRssListMode
        q?: string
        limit?: number
      },
    ) => {
      return rss.listArticles(workspaceId, input ?? {})
    },
  )

  server.handle(
    RPC_CHANNELS.rss.GET_ARTICLE,
    async (_ctx: unknown, workspaceId: string, articleId: string) => {
      return rss.getArticle(workspaceId, articleId)
    },
  )

  server.handle(
    RPC_CHANNELS.rss.TOGGLE_STAR,
    async (_ctx: unknown, workspaceId: string, article: CraftModulesRssArticle, starred: boolean) => {
      return rss.toggleStar(workspaceId, article, starred)
    },
  )

  server.handle(RPC_CHANNELS.rss.STARRED_COUNT, async (_ctx: unknown, workspaceId: string) => {
    return rss.starredCount(workspaceId)
  })

  server.handle(
    RPC_CHANNELS.rss.REFRESH,
    async (_ctx: unknown, workspaceId: string, feedId?: string) => {
      return rss.refreshFeeds(workspaceId, feedId)
    },
  )

  server.handle(RPC_CHANNELS.rss.GET_SETTINGS, async (_ctx: unknown, workspaceId: string) => {
    return rss.getRssSettings(workspaceId)
  })

  server.handle(
    RPC_CHANNELS.rss.PATCH_SETTINGS,
    async (_ctx: unknown, workspaceId: string, input: { rsshub_base_url: string }) => {
      return rss.patchRssSettings(workspaceId, input)
    },
  )
}
