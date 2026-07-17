import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import * as craftModules from '@craft-agent/shared/craft-modules'
import type {
  CraftModulesWorkflowCreateInput,
  CraftModulesWorkflowUpdateInput,
} from '@craft-agent/shared/craft-modules'

/** Minimal server surface so domain packages do not depend on server-core. */
export type DomainRpcServer = {
  handle: (channel: string, handler: (...args: any[]) => any) => void
}

export type RegisterWorkflowsRpcOptions = {
  /**
   * When true, skip `workflows:run` so server-core can register a Craft-side
   * executor that runs real agent sessions (see workflows-run.ts).
   */
  skipRun?: boolean
}

/**
 * Workflows domain RPC — thin proxy to craft-modules Go sidecar.
 * Workspace data: ~/.craft-agent/workspaces/{id}/modules/workflows/
 *
 * `workflows:run` may be owned by server-core (Craft agent execution). Pass
 * `skipRun: true` when registering from domain-stubs alongside that handler.
 */
export function registerWorkflowsRpcHandlers(
  server: DomainRpcServer,
  opts?: RegisterWorkflowsRpcOptions,
): void {
  server.handle(RPC_CHANNELS.workflows.PING, async () => {
    try {
      return await craftModules.workflowsPing()
    } catch {
      return { ok: false as const, domain: 'workflows' as const }
    }
  })

  server.handle(RPC_CHANNELS.workflows.LIST, async (_ctx: unknown, workspaceId: string) => {
    return craftModules.listWorkflows(workspaceId)
  })

  server.handle(
    RPC_CHANNELS.workflows.GET,
    async (_ctx: unknown, workspaceId: string, workflowId: string) => {
      return craftModules.getWorkflow(workspaceId, workflowId)
    },
  )

  server.handle(
    RPC_CHANNELS.workflows.CREATE,
    async (_ctx: unknown, workspaceId: string, input: CraftModulesWorkflowCreateInput) => {
      return craftModules.createWorkflow(workspaceId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.workflows.UPDATE,
    async (
      _ctx: unknown,
      workspaceId: string,
      workflowId: string,
      input: CraftModulesWorkflowUpdateInput,
    ) => {
      return craftModules.updateWorkflow(workspaceId, workflowId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.workflows.DELETE,
    async (_ctx: unknown, workspaceId: string, workflowId: string) => {
      await craftModules.deleteWorkflow(workspaceId, workflowId)
      return { ok: true as const }
    },
  )

  if (!opts?.skipRun) {
    server.handle(
      RPC_CHANNELS.workflows.RUN,
      async (_ctx: unknown, workspaceId: string, workflowId: string) => {
        return craftModules.runWorkflow(workspaceId, workflowId)
      },
    )
  }
}
