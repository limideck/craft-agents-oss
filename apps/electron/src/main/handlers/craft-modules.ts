/**
 * craft-modules sidecar IPC handlers (lifecycle / status).
 */

import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { getWorkspaces } from '@craft-agent/shared/config'
import {
  ensureCraftModulesMcpSource,
  ensureCraftModulesSidecar,
  getCraftModulesSidecarStatus,
  restartCraftModulesSidecar,
  type CraftModulesSidecarConfig,
} from '@craft-agent/shared/craft-modules'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from './handler-deps'

export const GUI_HANDLED_CHANNELS = [
  RPC_CHANNELS.craftModules.GET_STATUS,
  RPC_CHANNELS.craftModules.GET_CONFIG,
  RPC_CHANNELS.craftModules.RESTART,
] as const

async function ensureSourcesForLocalWorkspaces(config: CraftModulesSidecarConfig): Promise<void> {
  const localWorkspaces = getWorkspaces().filter((ws) => !ws.remoteServer)
  for (const ws of localWorkspaces) {
    try {
      await ensureCraftModulesMcpSource({
        workspaceRootPath: ws.rootPath,
        baseUrl: config.baseUrl,
        token: config.token,
      })
    } catch (err) {
      console.warn('[craft-modules] ensure MCP source failed', ws.id, err)
    }
  }
}

export function registerCraftModulesHandlers(server: RpcServer, _deps: HandlerDeps): void {
  server.handle(RPC_CHANNELS.craftModules.GET_STATUS, async () => {
    return getCraftModulesSidecarStatus()
  })

  server.handle(RPC_CHANNELS.craftModules.GET_CONFIG, async () => {
    const config = await ensureCraftModulesSidecar()
    await ensureSourcesForLocalWorkspaces(config)
    return config
  })

  server.handle(RPC_CHANNELS.craftModules.RESTART, async () => {
    const config = await restartCraftModulesSidecar()
    await ensureSourcesForLocalWorkspaces(config)
    return config
  })
}
