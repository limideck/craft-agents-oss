import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import * as groseModules from '@grose-agent/shared/grose-modules'
import type {
  GroseModulesWorkflowCreateInput,
  GroseModulesWorkflowUpdateInput,
} from '@grose-agent/shared/grose-modules'

/** Minimal server surface so domain packages do not depend on server-core. */
export type DomainRpcServer = {
  handle: (channel: string, handler: (...args: any[]) => any) => void
}

export type RegisterWorkflowsRpcOptions = {
  /**
   * When true, skip `workflows:run` so server-core can register a Grose-side
   * executor that runs real agent sessions (see workflows-run.ts).
   */
  skipRun?: boolean
}

/**
 * Workflows domain RPC — thin proxy to grose-modules Go sidecar.
 * Workspace data: `{rootPath}/modules/workflows/` (see docs/workspace-storage.md).
 *
 * `workflows:run` may be owned by server-core (Grose agent execution). Pass
 * `skipRun: true` when registering from domain-stubs alongside that handler.
 */
export function registerWorkflowsRpcHandlers(
  server: DomainRpcServer,
  opts?: RegisterWorkflowsRpcOptions,
): void {
  server.handle(RPC_CHANNELS.workflows.PING, async () => {
    try {
      return await groseModules.workflowsPing()
    } catch {
      return { ok: false as const, domain: 'workflows' as const }
    }
  })

  server.handle(RPC_CHANNELS.workflows.LIST, async (_ctx: unknown, workspaceId: string) => {
    return groseModules.listWorkflows(workspaceId)
  })

  server.handle(
    RPC_CHANNELS.workflows.GET,
    async (_ctx: unknown, workspaceId: string, workflowId: string) => {
      return groseModules.getWorkflow(workspaceId, workflowId)
    },
  )

  server.handle(
    RPC_CHANNELS.workflows.CREATE,
    async (_ctx: unknown, workspaceId: string, input: GroseModulesWorkflowCreateInput) => {
      return groseModules.createWorkflow(workspaceId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.workflows.UPDATE,
    async (
      _ctx: unknown,
      workspaceId: string,
      workflowId: string,
      input: GroseModulesWorkflowUpdateInput,
    ) => {
      return groseModules.updateWorkflow(workspaceId, workflowId, input)
    },
  )

  server.handle(
    RPC_CHANNELS.workflows.DELETE,
    async (_ctx: unknown, workspaceId: string, workflowId: string) => {
      await groseModules.deleteWorkflow(workspaceId, workflowId)
      return { ok: true as const }
    },
  )

  if (!opts?.skipRun) {
    server.handle(
      RPC_CHANNELS.workflows.RUN,
      async (_ctx: unknown, workspaceId: string, workflowId: string) => {
        return groseModules.runWorkflow(workspaceId, workflowId)
      },
    )
  }

  // Deploy is always Go-owned (unlike RUN which Grose may own).
  server.handle(
    RPC_CHANNELS.workflows.DEPLOY,
    async (_ctx: unknown, workspaceId: string, workflowId: string) => {
      return groseModules.deployWorkflow(workspaceId, workflowId)
    },
  )

  server.handle(
    RPC_CHANNELS.workflows.UNDEPLOY,
    async (_ctx: unknown, workspaceId: string, workflowId: string) => {
      return groseModules.undeployWorkflow(workspaceId, workflowId)
    },
  )
}
