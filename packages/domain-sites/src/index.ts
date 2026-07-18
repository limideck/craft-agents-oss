import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import * as groseModules from '@grose-agent/shared/grose-modules'
import type {
  GroseModulesSiteCreateInput,
  GroseModulesSiteUpdateInput,
  GroseModulesVisualEditSaveInput,
} from '@grose-agent/shared/grose-modules'

/** Minimal server surface so domain packages do not depend on server-core. */
export type DomainRpcServer = {
  handle: (channel: string, handler: (...args: any[]) => any) => void
}

/**
 * Sites domain RPC — thin proxy to grose-modules Go sidecar.
 * Workspace data: `{rootPath}/modules/sites/` (see docs/workspace-storage.md).
 */
export function registerSitesRpcHandlers(server: DomainRpcServer): void {
  server.handle(RPC_CHANNELS.sites.PING, async () => {
    try {
      return await groseModules.sitesPing()
    } catch {
      return { ok: false as const, domain: 'sites' as const }
    }
  })

  server.handle(RPC_CHANNELS.sites.LIST, async (_ctx: unknown, workspaceId: string) => {
    return groseModules.listSites(workspaceId)
  })

  server.handle(
    RPC_CHANNELS.sites.GET,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return groseModules.getSite(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.CREATE,
    async (_ctx: unknown, workspaceId: string, input: GroseModulesSiteCreateInput) => {
      return groseModules.createSite(workspaceId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.UPDATE,
    async (
      _ctx: unknown,
      workspaceId: string,
      siteId: string,
      input: GroseModulesSiteUpdateInput,
    ) => {
      return groseModules.updateSite(workspaceId, siteId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.DELETE,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      await groseModules.deleteSite(workspaceId, siteId)
      return { ok: true as const }
    },
  )

  server.handle(
    RPC_CHANNELS.sites.LIST_FILES,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return groseModules.listSiteFiles(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.READ_FILE,
    async (_ctx: unknown, workspaceId: string, siteId: string, path: string) => {
      return groseModules.readSiteFile(workspaceId, siteId, path)
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
      return groseModules.writeSiteFile(workspaceId, siteId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.PREVIEW_START,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return groseModules.startSitePreview(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.PREVIEW_STOP,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return groseModules.stopSitePreview(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.PREVIEW_URL,
    async (_ctx: unknown, workspaceId: string, siteId: string) => {
      return groseModules.getSitePreview(workspaceId, siteId)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.VISUAL_EDIT_SAVE,
    async (_ctx: unknown, workspaceId: string, input: GroseModulesVisualEditSaveInput) => {
      return groseModules.saveSiteVisualEdit(workspaceId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.sites.BIND_SESSION,
    async (_ctx: unknown, workspaceId: string, siteId: string, sessionId: string | null) => {
      return groseModules.bindSiteSession(workspaceId, siteId, sessionId)
    },
  )
}
