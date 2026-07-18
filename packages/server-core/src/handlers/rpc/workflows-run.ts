/**
 * workflows:run — Grose-side orchestration for agent nodes.
 *
 * Go accepts the run (runId + stub steps for non-LLM tooling). Grose loads the
 * graph, executes `agent` nodes via SessionManager, and returns real step I/O.
 */

import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import * as groseModules from '@grose-agent/shared/grose-modules'
import type { GroseModulesWorkflowRunResult } from '@grose-agent/shared/grose-modules'
import { createLogger } from '@grose-agent/shared/utils'
import type { RpcServer } from '@grose-agent/server-core/transport'
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
    ): Promise<GroseModulesWorkflowRunResult> => {
      const workflow = await groseModules.getWorkflow(workspaceId, workflowId)
      const accepted = await groseModules.runWorkflow(workspaceId, workflowId)
      const runId = accepted.runId ?? `grose-${Date.now()}`

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
