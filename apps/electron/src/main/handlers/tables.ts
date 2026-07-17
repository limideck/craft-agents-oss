/**
 * Tables sidecar IPC handlers (lifecycle + HTTP proxy).
 */

import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { getActiveWorkspace, getWorkspaces } from '@craft-agent/shared/config'
import { ensureTablesMcpSource } from '@craft-agent/shared/sources'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from './handler-deps'
import type { TablesFetchRequest } from '../tables-sidecar'
import {
  ensureTablesSidecar,
  fetchTablesViaMain,
  getTablesSidecarStatus,
  restartTablesSidecar,
  type TablesSidecarConfig,
} from '../tables-sidecar'

export const GUI_HANDLED_CHANNELS = [
  RPC_CHANNELS.tables.GET_STATUS,
  RPC_CHANNELS.tables.GET_CONFIG,
  RPC_CHANNELS.tables.RESTART,
  RPC_CHANNELS.tables.FETCH,
] as const

function activeRootPath(): string | undefined {
  return getActiveWorkspace()?.rootPath
}

async function ensureSourcesForLocalWorkspaces(config: TablesSidecarConfig): Promise<void> {
  const localWorkspaces = getWorkspaces().filter((ws) => !ws.remoteServer)
  for (const ws of localWorkspaces) {
    try {
      await ensureTablesMcpSource({
        workspaceRootPath: ws.rootPath,
        baseUrl: config.baseUrl,
        token: config.token,
      })
    } catch (err) {
      console.warn('[tables] ensure MCP source failed', ws.id, err)
    }
  }
}

export function registerTablesHandlers(server: RpcServer, _deps: HandlerDeps): void {
  server.handle(RPC_CHANNELS.tables.GET_STATUS, async () => {
    return getTablesSidecarStatus()
  })

  server.handle(RPC_CHANNELS.tables.GET_CONFIG, async () => {
    const config = await ensureTablesSidecar({ workspaceRootPath: activeRootPath() })
    await ensureSourcesForLocalWorkspaces(config)
    return config
  })

  server.handle(RPC_CHANNELS.tables.RESTART, async () => {
    const config = await restartTablesSidecar({ workspaceRootPath: activeRootPath() })
    await ensureSourcesForLocalWorkspaces(config)
    return config
  })

  server.handle(RPC_CHANNELS.tables.FETCH, async (_ctx, request: TablesFetchRequest) => {
    return fetchTablesViaMain({
      ...request,
      workspaceRootPath: request.workspaceRootPath ?? activeRootPath(),
    })
  })
}
