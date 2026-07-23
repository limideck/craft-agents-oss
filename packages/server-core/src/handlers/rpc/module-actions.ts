/**
 * moduleActions:run — silent Module Action runner for workbench UI.
 */

import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import type {
  ModuleActionRunRequest,
  ModuleActionRunResponse,
} from '@grose-agent/shared/protocol'
import { createLogger } from '@grose-agent/shared/utils'
import type { RpcServer } from '@grose-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { runModuleAction } from '../../module-actions/run-module-action'

const log = createLogger('module-actions')

export const HANDLED_CHANNELS = [RPC_CHANNELS.moduleActions.RUN] as const

export function registerModuleActionsHandler(server: RpcServer, deps: HandlerDeps): void {
  server.handle(
    RPC_CHANNELS.moduleActions.RUN,
    async (
      _ctx: unknown,
      workspaceId: string,
      request: ModuleActionRunRequest,
    ): Promise<ModuleActionRunResponse> => {
      if (!workspaceId?.trim()) {
        throw new Error('workspaceId is required')
      }
      if (!request?.actionId?.trim()) {
        throw new Error('actionId is required')
      }

      const result = await runModuleAction({
        workspaceId,
        actionId: request.actionId,
        params: {
          articleId: request.articleId,
          url: request.url,
          feedUrl: request.feedUrl,
          sourceUrl: request.sourceUrl,
          title: request.title,
          selection: request.selection,
          selectionNote: request.selectionNote,
        },
        model: request.model,
        timeoutMs: request.timeoutMs,
        host: deps.sessionManager,
      })

      if (!result.ok) {
        log.warn('module action failed', {
          workspaceId,
          actionId: result.actionId,
          error: result.error,
          sessionId: result.sessionId,
        })
        return {
          ok: false,
          actionId: result.actionId,
          error: result.error,
          ...(result.sessionId ? { sessionId: result.sessionId } : {}),
          durationMs: result.durationMs,
        }
      }

      return {
        ok: true,
        actionId: result.actionId,
        moduleId: result.moduleId,
        resultMarkdown: result.resultMarkdown,
        sessionId: result.sessionId,
        durationMs: result.durationMs,
      }
    },
  )
}
