import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Plus, Trash2, Workflow } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ActivityShell } from '../../../shell/ActivityShell'
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

type WorkflowListViewProps = {
  /** When nested under Automations (Flows segment), skip ActivityShell chrome. */
  embedded?: boolean
}

/**
 * ActivityBar side rail — workflow list (create + select + delete). Not a dock panel.
 */
export function WorkflowListView({ embedded = false }: WorkflowListViewProps) {
  const { t } = useTranslation()
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
      toast.message(t('workbench.automations.noWorkspace'))
      return
    }
    try {
      const wf = await createWorkflowViaRpc(workspaceId)
      setWorkflows((prev) => [wf, ...prev.filter((w) => w.id !== wf.id)])
      setSelectedId(wf.id)
      setSelectedNodeId(wf.nodes[0]?.id ?? null)
      setRunStatus({})
      setRightTab('editor')
      toast.success(t('workbench.automations.flowCreated'))
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
      toast.success(t('workbench.automations.flowDeleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      await refresh()
    }
  }

  const newFlowButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      title={t('workbench.automations.newFlow')}
      disabled={!workspaceId}
      onClick={() => void createWorkflow()}
    >
      <Plus className="h-3.5 w-3.5" />
    </Button>
  )

  const listBody =
    loading && workflows.length === 0 ? (
      <WorkflowListSkeleton />
    ) : error && workflows.length === 0 ? (
      <div className="p-4 text-sm text-muted-foreground space-y-2">
        <p className="text-destructive/90">{error}</p>
        {/sidecar|unavailable|ECONNREFUSED|fetch failed|not ready/i.test(error) ? (
          <p className="text-xs">{t('workbench.automations.sidecarHint')}</p>
        ) : null}
      </div>
    ) : workflows.length === 0 ? (
      <div className="p-4 text-sm text-muted-foreground space-y-2">
        <p>{t('workbench.automations.flowsEmptyTitle')}</p>
        <p className="text-xs">{t('workbench.automations.flowsEmptyDescription')}</p>
      </div>
    ) : (
      <ul className="py-1" role="listbox" aria-label={t('workbench.automations.flows')}>
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
                    {wf.status === 'deployed' && wf.version > 0 ? (
                      <>
                        Deployed · v{wf.version}
                        <span aria-hidden> · </span>
                      </>
                    ) : null}
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
                title={t('workbench.automations.deleteFlow')}
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
    )

  if (embedded) {
    return (
      <div className="h-full flex flex-col min-h-0 bg-background">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 shrink-0 border-b border-border">
          <span className="text-xs font-medium truncate text-muted-foreground">
            {t('workbench.automations.flows')}
          </span>
          <div className="flex-1" />
          {newFlowButton}
        </div>
        <div className="flex-1 min-h-0 overflow-auto">{listBody}</div>
      </div>
    )
  }

  return (
    <ActivityShell title={t('workbench.automations.flows')} actions={newFlowButton}>
      {listBody}
    </ActivityShell>
  )
}
