/**
 * OpenConnector IPC handlers (local sidecar lifecycle + HTTP proxy).
 */

import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { getWorkspaces } from '@craft-agent/shared/config'
import { ensureOpenConnectorMcpSource } from '@craft-agent/shared/sources'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from './handler-deps'
import type { OpenConnectorFetchRequest } from '../open-connector-sidecar'
import {
  ensureOpenConnectorSidecar,
  fetchOpenConnectorViaMain,
  getOpenConnectorSidecarStatus,
  restartOpenConnectorSidecar,
  type OpenConnectorSidecarConfig,
} from '../open-connector-sidecar'

export const GUI_HANDLED_CHANNELS = [
  RPC_CHANNELS.openConnector.GET_STATUS,
  RPC_CHANNELS.openConnector.GET_CONFIG,
  RPC_CHANNELS.openConnector.RESTART,
  RPC_CHANNELS.openConnector.FETCH,
] as const

async function ensureSourcesForLocalWorkspaces(config: OpenConnectorSidecarConfig): Promise<void> {
  const localWorkspaces = getWorkspaces().filter((ws) => !ws.remoteServer)
  for (const ws of localWorkspaces) {
    try {
      await ensureOpenConnectorMcpSource({
        workspaceRootPath: ws.rootPath,
        baseUrl: config.baseUrl,
        runtimeToken: config.runtimeToken,
      })
    } catch (err) {
      console.warn('[open-connector] ensure MCP source failed', ws.id, err)
    }
  }
}

export function registerOpenConnectorHandlers(server: RpcServer, _deps: HandlerDeps): void {
  server.handle(RPC_CHANNELS.openConnector.GET_STATUS, async () => {
    return getOpenConnectorSidecarStatus()
  })

  server.handle(RPC_CHANNELS.openConnector.GET_CONFIG, async () => {
    const config = await ensureOpenConnectorSidecar()
    await ensureSourcesForLocalWorkspaces(config)
    return config
  })

  server.handle(RPC_CHANNELS.openConnector.RESTART, async () => {
    const config = await restartOpenConnectorSidecar()
    await ensureSourcesForLocalWorkspaces(config)
    return config
  })

  server.handle(RPC_CHANNELS.openConnector.FETCH, async (_ctx, request: OpenConnectorFetchRequest) => {
    return fetchOpenConnectorViaMain(request)
  })
}
