/**
 * grose-modules sidecar IPC handlers (lifecycle / status).
 */

import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import { getActiveWorkspace, getWorkspaces } from '@grose-agent/shared/config'
import {
  ensureGroseModulesMcpSource,
  ensureGroseModulesSidecar,
  getGroseModulesSidecarStatus,
  restartGroseModulesSidecar,
  type GroseModulesSidecarConfig,
} from '@grose-agent/shared/grose-modules'
import type { RpcServer } from '@grose-agent/server-core/transport'
import type { HandlerDeps } from './handler-deps'

export const GUI_HANDLED_CHANNELS = [
  RPC_CHANNELS.groseModules.GET_STATUS,
  RPC_CHANNELS.groseModules.GET_CONFIG,
  RPC_CHANNELS.groseModules.RESTART,
] as const

function defaultWorkspaceId(): string | undefined {
  return getActiveWorkspace()?.id
}

async function ensureSourcesForLocalWorkspaces(config: GroseModulesSidecarConfig): Promise<void> {
  const localWorkspaces = getWorkspaces().filter((ws) => !ws.remoteServer)
  for (const ws of localWorkspaces) {
    try {
      await ensureGroseModulesMcpSource({
        workspaceRootPath: ws.rootPath,
        baseUrl: config.baseUrl,
        token: config.token,
      })
    } catch (err) {
      console.warn('[grose-modules] ensure MCP source failed', ws.id, err)
    }
  }
}

export function registerGroseModulesHandlers(server: RpcServer, _deps: HandlerDeps): void {
  server.handle(RPC_CHANNELS.groseModules.GET_STATUS, async () => {
    return getGroseModulesSidecarStatus()
  })

  server.handle(RPC_CHANNELS.groseModules.GET_CONFIG, async () => {
    const config = await ensureGroseModulesSidecar({ defaultWorkspaceId: defaultWorkspaceId() })
    await ensureSourcesForLocalWorkspaces(config)
    return config
  })

  server.handle(RPC_CHANNELS.groseModules.RESTART, async () => {
    const config = await restartGroseModulesSidecar({ defaultWorkspaceId: defaultWorkspaceId() })
    await ensureSourcesForLocalWorkspaces(config)
    return config
  })
}
