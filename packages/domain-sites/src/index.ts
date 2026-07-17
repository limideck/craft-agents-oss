import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import * as craftModules from '@craft-agent/shared/craft-modules'
import type {
  CraftModulesSiteCreateInput,
  CraftModulesSiteUpdateInput,
  CraftModulesVisualEditSaveInput,
} from '@craft-agent/shared/craft-modules'

/** Minimal server surface so domain packages do not depend on server-core. */
export type DomainRpcServer = {
  handle: (channel: string, handler: (...args: any[]) => any) => void
}

/**
 * Sites domain RPC — thin proxy to craft-modules Go sidecar.
 * Workspace data: `{rootPath}/modules/sites/` (see docs/workspace-storage.md).
 */
export function registerSitesRpcHandlers(server: DomainRpcServer): void {
  server.handle(RPC_CHANNELS.sites.PING, async () => {
    try {
      return await craftModules.sitesPing()
    } catch {
      return { ok: false as const, domain: 'sites' as const }
    }
  })

  server.handle(RPC_CHANNELS.sites.LIST, async (_ctx: unknown, workspaceId: string) => {
    return craftModules.listSites(workspaceId)
  })

  server.handle(
    RPC_CHANNELS.sites.GET,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return craftModules.getSite(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.CREATE,
    async (_ctx: unknown, workspaceId: string, input: CraftModulesSiteCreateInput) => {
      return craftModules.createSite(workspaceId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.UPDATE,
    async (
      _ctx: unknown,
      workspaceId: string,
      siteId: string,
      input: CraftModulesSiteUpdateInput,
    ) => {
      return craftModules.updateSite(workspaceId, siteId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.DELETE,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      await craftModules.deleteSite(workspaceId, siteId)
      return { ok: true as const }
    },
  )

  server.handle(
    RPC_CHANNELS.sites.LIST_FILES,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return craftModules.listSiteFiles(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.READ_FILE,
    async (_ctx: unknown, workspaceId: string, siteId: string, path: string) => {
      return craftModules.readSiteFile(workspaceId, siteId, path)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.WRITE_FILE,
    async (
      _ctx: unknown,
      workspaceId: string,
      siteId: string,
      input: { path: string; content: string },
    ) => {
      return craftModules.writeSiteFile(workspaceId, siteId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.PREVIEW_START,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return craftModules.startSitePreview(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.PREVIEW_STOP,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return craftModules.stopSitePreview(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.PREVIEW_URL,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return craftModules.getSitePreview(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.VISUAL_EDIT_SAVE,
    async (_ctx: unknown, workspaceId: string, input: CraftModulesVisualEditSaveInput) => {
      return craftModules.saveSiteVisualEdit(workspaceId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.BIND_SESSION,
    async (_ctx: unknown, workspaceId: string, siteId: string, sessionId: string | null) => {
      return craftModules.bindSiteSession(workspaceId, siteId, sessionId)
    },
  )
}
