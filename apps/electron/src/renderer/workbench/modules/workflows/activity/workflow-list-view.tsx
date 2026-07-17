import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Plus, Trash2, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  selectedNodeIdAtom,
  selectedWorkflowIdAtom,
  workflowErrorAtom,
  workflowLoadingAtom,
  workflowNodeRunStatusAtom,
  workflowRightTabAtom,
  workflowsAtom,
} from '../store'
import {
  createWorkflowViaRpc,
  deleteWorkflowViaRpc,
  useWorkflowWorkspaceData,
} from '../use-workflow-data'

function formatUpdated(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function WorkflowListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5 animate-pulse">
          <div className="h-3.5 rounded bg-foreground-10 w-[80%]" />
          <div className="h-2.5 rounded bg-foreground-5 w-[50%]" />
        </div>
      ))}
    </div>
  )
}

/**
 * ActivityBar side rail — workflow list (create + select + delete). Not a dock panel.
 */
export function WorkflowListView() {
  const { refresh, workspaceId } = useWorkflowWorkspaceData({ bootstrap: true })
  const [workflows, setWorkflows] = useAtom(workflowsAtom)
  const [selectedId, setSelectedId] = useAtom(selectedWorkflowIdAtom)
  const setSelectedNodeId = useSetAtom(selectedNodeIdAtom)
  const setRightTab = useSetAtom(workflowRightTabAtom)
  const setRunStatus = useSetAtom(workflowNodeRunStatusAtom)
  const loading = useAtomValue(workflowLoadingAtom)
  const error = useAtomValue(workflowErrorAtom)

  const createWorkflow = async () => {
    if (!workspaceId) {
      toast.message('No workspace')
      return
    }
    try {
      const wf = await createWorkflowViaRpc(workspaceId)
      setWorkflows((prev) => [wf, ...prev.filter((w) => w.id !== wf.id)])
      setSelectedId(wf.id)
      setSelectedNodeId(wf.nodes[0]?.id ?? null)
      setRunStatus({})
      setRightTab('editor')
      toast.success('Workflow created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      await refresh()
    }
  }

  const removeWorkflow = async (id: string) => {
    if (!workspaceId) return
    try {
      await deleteWorkflowViaRpc(workspaceId, id)
      setWorkflows((prev) => {
        const next = prev.filter((w) => w.id !== id)
        if (selectedId === id) {
          const pick = next[0]
          setSelectedId(pick?.id ?? null)
          setSelectedNodeId(pick?.nodes[0]?.id ?? null)
          setRunStatus({})
        }
        return next
      })
      toast.success('Workflow deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      await refresh()
    }
  }

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between">
        <span className="font-medium truncate">Workflows</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="New workflow"
          disabled={!workspaceId}
          onClick={() => void createWorkflow()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PanelHeaderBar>
      <PanelBody padding={false} className="p-0">
        {loading && workflows.length === 0 ? (
          <WorkflowListSkeleton />
        ) : error && workflows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground space-y-2">
            <p className="text-destructive/90">{error}</p>
            {/sidecar|unavailable|ECONNREFUSED|fetch failed|not ready/i.test(error) ? (
              <p className="text-xs">
                Build/start the Go sidecar (`bun run build:craft-modules`) or set `CRAFT_MODULES_URL`.
              </p>
            ) : null}
          </div>
        ) : workflows.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No workflows yet.</div>
        ) : (
          <ul className="py-1" role="listbox" aria-label="Workflows">
            {workflows.map((wf) => {
              const active = selectedId === wf.id
              return (
                <li key={wf.id} className="group relative">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 pr-8 text-left',
                      'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
                      active && 'bg-foreground-10 text-foreground',
                      !active && 'text-foreground/90',
                    )}
                    onClick={() => {
                      setSelectedId(wf.id)
                      setSelectedNodeId(wf.nodes[0]?.id ?? null)
                      setRunStatus({})
                    }}
                  >
                    <Workflow className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-sm font-medium truncate">{wf.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {wf.description || `${wf.nodes.length} nodes`}
                        <span aria-hidden> · </span>
                        {formatUpdated(wf.updatedAt)}
                      </div>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'absolute right-1 top-1.5 h-6 w-6 opacity-0 group-hover:opacity-100',
                      'focus-visible:opacity-100',
                    )}
                    title="Delete workflow"
                    onClick={(e) => {
                      e.stopPropagation()
                      void removeWorkflow(wf.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
