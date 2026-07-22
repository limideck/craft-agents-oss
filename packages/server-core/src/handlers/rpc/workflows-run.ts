/**
 * workflows:run + workflows:getHistory — Grose-side orchestration for agent nodes
 * and a shared runs-history store (mirrors the Automations Rules history).
 *
 * Go accepts the run (runId + stub steps for non-LLM tooling). Grose loads the
 * graph, executes `agent` nodes via SessionManager, and returns real step I/O.
 * Every run (manual or auto-fired via the trigger scheduler) is persisted to the
 * same per-workspace `automations-history.jsonl` the Rules UI reads, discriminated
 * by `kind: 'flow'` so the two surfaces can be told apart.
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import * as groseModules from '@grose-agent/shared/grose-modules'
import type { GroseModulesWorkflowRunResult } from '@grose-agent/shared/grose-modules'
import { getWorkspaceByNameOrId } from '@grose-agent/shared/config'
import { appendAutomationHistoryEntry } from '@grose-agent/shared/automations/history-store'
import { createFlowHistoryEntry } from '@grose-agent/shared/automations/webhook-utils'
import { AUTOMATION_HISTORY_MAX_RUNS_PER_MATCHER } from '@grose-agent/shared/automations/constants'
import { createLogger } from '@grose-agent/shared/utils'
import type { RpcServer } from '@grose-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { executeWorkflowRun } from '../../workflows/execute-workflow-run'

const log = createLogger('workflows-run')

// History file name — same JSONL store as Automations Rules.
const HISTORY_FILE = 'automations-history.jsonl'

interface FlowHistoryEntry {
  kind: 'flow'
  id: string
  runId: string
  ts: number
  ok: boolean
  summary?: string
  stepCount?: number
  error?: string
}

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.workflows.RUN,
  RPC_CHANNELS.workflows.GET_HISTORY,
] as const

export function registerWorkflowsRunHandler(server: RpcServer, deps: HandlerDeps): void {
  server.handle(
    RPC_CHANNELS.workflows.RUN,
    async (
      _ctx: unknown,
      workspaceId: string,
      workflowId: string,
    ): Promise<GroseModulesWorkflowRunResult> => {
      const workspace = getWorkspaceByNameOrId(workspaceId)
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
        const stepCount = Array.isArray(steps) ? steps.length : 0
        if (workspace) {
          try {
            await appendAutomationHistoryEntry(
              workspace.rootPath,
              createFlowHistoryEntry({
                workflowId,
                runId,
                ok: true,
                summary: `${stepCount} step${stepCount === 1 ? '' : 's'} executed`,
                stepCount,
              }),
            )
          } catch (e) {
            log.warn('workflow run history write failed', { workflowId, runId, error: String(e) })
          }
        }
        return {
          accepted: true,
          runId,
          steps,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log.error('workflow run failed', { workspaceId, workflowId, runId, error: message })
        if (workspace) {
          try {
            await appendAutomationHistoryEntry(
              workspace.rootPath,
              createFlowHistoryEntry({
                workflowId,
                runId,
                ok: false,
                error: message,
              }),
            )
          } catch (e) {
            log.warn('workflow run failure history write failed', { workflowId, runId, error: String(e) })
          }
        }
        throw err
      }
    },
  )

  // Read execution history for a specific workflow (flow run history).
  server.handle(
    RPC_CHANNELS.workflows.GET_HISTORY,
    async (_ctx: unknown, workspaceId: string, workflowId: string, limit = AUTOMATION_HISTORY_MAX_RUNS_PER_MATCHER) => {
      const workspace = getWorkspaceByNameOrId(workspaceId)
      if (!workspace) throw new Error('Workspace not found')

      const clampedLimit = Math.max(1, Math.min(limit, AUTOMATION_HISTORY_MAX_RUNS_PER_MATCHER))
      const historyPath = join(workspace.rootPath, HISTORY_FILE)
      try {
        const content = await readFile(historyPath, 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean)

        return lines
          .map(line => { try { return JSON.parse(line) } catch { return null } })
          .filter((e): e is FlowHistoryEntry => e?.kind === 'flow' && e?.id === workflowId)
          .slice(-clampedLimit)
          .reverse()
      } catch {
        return [] // File doesn't exist yet
      }
    },
  )
}
