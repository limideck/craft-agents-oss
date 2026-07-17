/**
 * workflows:run — Craft-side orchestration for agent nodes.
 *
 * Go accepts the run (runId + stub steps for non-LLM tooling). Craft loads the
 * graph, executes `agent` nodes via SessionManager, and returns real step I/O.
 */

import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import * as craftModules from '@craft-agent/shared/craft-modules'
import type { CraftModulesWorkflowRunResult } from '@craft-agent/shared/craft-modules'
import { createLogger } from '@craft-agent/shared/utils'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { executeWorkflowRun } from '../../workflows/execute-workflow-run'

const log = createLogger('workflows-run')

export const HANDLED_CHANNELS = [RPC_CHANNELS.workflows.RUN] as const

export function registerWorkflowsRunHandler(server: RpcServer, deps: HandlerDeps): void {
  server.handle(
    RPC_CHANNELS.workflows.RUN,
    async (
      _ctx: unknown,
      workspaceId: string,
      workflowId: string,
    ): Promise<CraftModulesWorkflowRunResult> => {
      const workflow = await craftModules.getWorkflow(workspaceId, workflowId)
      const accepted = await craftModules.runWorkflow(workspaceId, workflowId)
      const runId = accepted.runId ?? `craft-${Date.now()}`

      try {
        const steps = await executeWorkflowRun({
          workspaceId,
          workflow,
          runId,
          host: deps.sessionManager,
        })
        return {
          accepted: true,
          runId,
          steps,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log.error('workflow run failed', { workspaceId, workflowId, runId, error: message })
        throw err
      }
    },
  )
}
