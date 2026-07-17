import { useMemo, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { toast } from 'sonner'
import { MessageSquare, Play, Rocket, Search, SlidersHorizontal, Wrench } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppShellContext } from '@/context/AppShellContext'
import {
  ACCENT_DOT,
  ACCENT_TILE,
  ACTION_BLOCKS,
  AI_BLOCKS,
  CATEGORY_ACCENT,
  CATEGORY_SECTIONS,
  DATA_BLOCKS,
  FLOW_BLOCKS,
  TRIGGER_BLOCKS,
  formatNodeType,
  getNodeIcon,
  type BlockCategory,
  type BlockConfig,
} from '../blocks'
import { BlockEditorForm } from '../components/block-editor-form'
import type { WorkflowNodeType, WorkflowRightTab } from '../mock/types'
import {
  WORKFLOW_BLOCK_DND_MIME,
  addNode,
  appendLogLine,
  selectedLogStepIdAtom,
  selectedNodeIdAtom,
  selectedWorkflowIdAtom,
  updateNodeConfig,
  workflowLogsAtom,
  workflowNodeRunStatusAtom,
  workflowRightTabAtom,
  workflowRunStepsAtom,
  workflowsAtom,
} from '../store'
import { runWorkflowViaRpc, scheduleWorkflowPersist, flushPendingWorkflowPersists, deployWorkflowViaRpc } from '../use-workflow-data'
import { normalizeRunSteps } from '../utils/synthesize-run-steps'
import { getNodeById, getWorkflowById } from '../utils/lookup'

const TABS: { id: WorkflowRightTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'toolbar', label: 'Toolbar', icon: Wrench },
  { id: 'editor', label: 'Editor', icon: SlidersHorizontal },
]

const CATEGORY_ITEMS: Record<BlockCategory, BlockConfig[]> = {
  triggers: TRIGGER_BLOCKS,
  ai: AI_BLOCKS,
  flow: FLOW_BLOCKS,
  data: DATA_BLOCKS,
  action: ACTION_BLOCKS,
}

/**
 * Right column — Chat | Toolbar | Editor (CSS hide/show).
 * Run calls `workflows:run` (Craft executes agent nodes; other nodes stay lightweight).
 * Deploy flushes pending saves then calls `workflows:deploy` (Go publishes live snapshot).
 */
export function RightPanel() {
  const { activeWorkspaceId } = useAppShellContext()
  const [tab, setTab] = useAtom(workflowRightTabAtom)
  const [workflows, setWorkflows] = useAtom(workflowsAtom)
  const selectedWorkflowId = useAtomValue(selectedWorkflowIdAtom)
  const [selectedNodeId, setSelectedNodeId] = useAtom(selectedNodeIdAtom)
  const setLogs = useSetAtom(workflowLogsAtom)
  const setRunSteps = useSetAtom(workflowRunStepsAtom)
  const setSelectedLogStepId = useSetAtom(selectedLogStepIdAtom)
  const setRunStatus = useSetAtom(workflowNodeRunStatusAtom)

  const workflow = getWorkflowById(workflows, selectedWorkflowId)
  const node = getNodeById(workflow, selectedNodeId)

  const onDeploy = async () => {
    if (!activeWorkspaceId || !selectedWorkflowId || !workflow) {
      toast.message('Select a workflow first')
      return
    }
    const name = workflow.name
    try {
      await flushPendingWorkflowPersists(selectedWorkflowId)
      const result = await deployWorkflowViaRpc(activeWorkspaceId, selectedWorkflowId)
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === selectedWorkflowId
            ? {
                ...w,
                status: result.status,
                version: result.version,
                ...(result.deployedAt ? { deployedAt: result.deployedAt } : {}),
              }
            : w,
        ),
      )
      const armed = result.triggersArmed?.armed
        ? ` · ${result.triggersArmed.triggers.length} trigger${result.triggersArmed.triggers.length === 1 ? '' : 's'} armed (stub)`
        : ''
      setLogs((prev) =>
        appendLogLine(
          prev,
          `Deployed: “${name}” · v${result.version}${armed}`,
          'success',
        ),
      )
      toast.success(`Deployed · v${result.version}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setLogs((prev) => appendLogLine(prev, `Deploy failed: ${message}`, 'warn'))
      toast.error(message)
    }
  }

  const onRun = async () => {
    if (!activeWorkspaceId || !selectedWorkflowId || !workflow) {
      toast.message('Select a workflow first')
      return
    }
    const name = workflow.name
    setRunStatus({})
    try {
      await flushPendingWorkflowPersists(selectedWorkflowId)
      const result = await runWorkflowViaRpc(activeWorkspaceId, selectedWorkflowId)
      const steps = normalizeRunSteps(
        result.steps,
        workflow.nodes,
        workflow.edges,
        result.runId,
      )
      setRunSteps(steps)
      setSelectedLogStepId(steps[0]?.id ?? null)

      const statusMap: Record<string, 'success' | 'error'> = {}
      for (const s of steps) {
        if (s.status === 'skipped') continue
        statusMap[s.nodeId] = s.status === 'error' ? 'error' : 'success'
      }
      setRunStatus(statusMap)

      const hasAgent = steps.some((s) => s.nodeType === 'agent')
      const agentFailed = steps.some((s) => s.nodeType === 'agent' && s.status === 'error')
      const runSuffix = result.runId ? ` runId=${result.runId}` : ''
      const summary = hasAgent
        ? agentFailed
          ? `Run finished with agent error: “${name}”${runSuffix} — ${steps.length} step${steps.length === 1 ? '' : 's'}.`
          : `Run completed: “${name}”${runSuffix} — ${steps.length} step${steps.length === 1 ? '' : 's'} (agent via Craft).`
        : `Run accepted: “${name}”${runSuffix} — ${steps.length} step${steps.length === 1 ? '' : 's'} (non-agent stubs).`
      setLogs((prev) =>
        appendLogLine(prev, summary, agentFailed ? 'warn' : 'success'),
      )
      if (agentFailed) {
        toast.error(`Run · agent step failed`)
      } else {
        toast.success(`Run · ${steps.length} steps`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setLogs((prev) => appendLogLine(prev, `Run failed: ${message}`, 'warn'))
      toast.error(message)
    }
  }

  const addBlock = (type: WorkflowNodeType) => {
    if (!selectedWorkflowId) {
      toast.message('Select a workflow first')
      return
    }
    const { workflows: next, nodeId } = addNode(workflows, selectedWorkflowId, type)
    setWorkflows(next)
    setSelectedNodeId(nodeId)
    setTab('editor')
    scheduleWorkflowPersist(selectedWorkflowId)
    setLogs((prev) => appendLogLine(prev, `Added ${formatNodeType(type)} block to canvas.`))
  }

  return (
    <PanelRoot>
      <PanelHeaderBarSplit
        className="gap-1"
        left={
          <div className="flex items-center gap-0.5 min-w-0" role="tablist" aria-label="Workflow tools">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                    'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
                    active ? 'bg-foreground-10 text-foreground font-medium' : 'text-muted-foreground',
                  )}
                  onClick={() => setTab(id)}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {label}
                </button>
              )
            })}
          </div>
        }
        right={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              title={
                workflow?.status === 'deployed'
                  ? `Redeploy live snapshot (currently v${workflow.version})`
                  : 'Publish current graph as live version'
              }
              disabled={!selectedWorkflowId || !activeWorkspaceId}
              onClick={() => void onDeploy()}
            >
              <Rocket className="h-3.5 w-3.5" />
              Deploy
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              title="Run (agent nodes via Craft)"
              disabled={!selectedWorkflowId || !activeWorkspaceId}
              onClick={() => void onRun()}
            >
              <Play className="h-3.5 w-3.5" />
              Run
            </Button>
          </>
        }
      />
      <PanelBody padding={false} scroll={false} className="relative p-0">
        <div className={cn('absolute inset-0 overflow-auto', tab !== 'chat' && 'hidden')} role="tabpanel">
          <ChatPlaceholder />
        </div>
        <div
          className={cn('absolute inset-0 overflow-auto', tab !== 'toolbar' && 'hidden')}
          role="tabpanel"
        >
          <ToolbarTab onAdd={addBlock} />
        </div>
        <div
          className={cn('absolute inset-0 overflow-auto', tab !== 'editor' && 'hidden')}
          role="tabpanel"
        >
          <EditorTab
            node={node}
            workflowName={workflow?.name}
            workflowId={selectedWorkflowId}
            onUpdate={(patch) => {
              if (!selectedWorkflowId || !selectedNodeId) return
              setWorkflows((prev) =>
                updateNodeConfig(prev, selectedWorkflowId, selectedNodeId, patch),
              )
              scheduleWorkflowPersist(selectedWorkflowId)
            }}
          />
        </div>
      </PanelBody>
    </PanelRoot>
  )
}

function ChatPlaceholder() {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 p-6 text-center">
      <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">Workflow chat placeholder.</p>
      <p className="text-xs text-muted-foreground/80 max-w-[240px]">
        Copilot / agent chat for this graph will land in a later phase.
      </p>
    </div>
  )
}

function PaletteNodeRow({
  item,
  onAdd,
}: {
  item: BlockConfig
  onAdd: (type: WorkflowNodeType) => void
}) {
  const Icon = getNodeIcon(item.type)
  const tile = ACCENT_TILE[item.accent] ?? 'bg-foreground-5 text-muted-foreground'

  return (
    <button
      type="button"
      draggable
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left',
        'cursor-grab active:cursor-grabbing',
        'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
        'active:bg-foreground-10',
      )}
      onClick={() => onAdd(item.type)}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          WORKFLOW_BLOCK_DND_MIME,
          JSON.stringify({ type: item.type }),
        )
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          tile,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-foreground">{item.label}</div>
        <div className="truncate text-[10px] text-muted-foreground">{item.description}</div>
      </div>
    </button>
  )
}

function PaletteSection({
  title,
  accent,
  items,
  onAdd,
}: {
  title: string
  accent: string
  items: BlockConfig[]
  onAdd: (type: WorkflowNodeType) => void
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 px-2 py-1">
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', ACCENT_DOT[accent] ?? 'bg-muted-foreground')}
          aria-hidden
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      <ul aria-label={title}>
        {items.map((item) => (
          <li key={item.type}>
            <PaletteNodeRow item={item} onAdd={onAdd} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ToolbarTab({ onAdd }: { onAdd: (type: WorkflowNodeType) => void }) {
  const [search, setSearch] = useState('')

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CATEGORY_SECTIONS.map((section) => {
      const items = CATEGORY_ITEMS[section.id].filter((b) => {
        if (!q) return true
        return (
          b.label.toLowerCase().includes(q) ||
          b.type.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
        )
      })
      return {
        ...section,
        accent: CATEGORY_ACCENT[section.id],
        items,
      }
    }).filter((g) => g.items.length > 0)
  }, [search])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-border/80 bg-card/95 px-3 py-2 backdrop-blur-sm">
        <p className="mb-2 text-[11px] text-muted-foreground">
          Click to add, or drag onto the canvas.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className={cn(
              'h-8 w-full rounded-md border border-border bg-background pl-8 pr-3',
              'text-xs text-foreground placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
            aria-label="Search workflow nodes"
          />
        </div>
      </div>
      <div className="flex-1 space-y-3 p-2">
        {grouped.map((group) => (
          <PaletteSection
            key={group.id}
            title={group.label}
            accent={group.accent}
            items={group.items}
            onAdd={onAdd}
          />
        ))}
        {grouped.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-muted-foreground">No nodes found</div>
        ) : null}
      </div>
    </div>
  )
}

function EditorTab({
  node,
  workflowName,
  workflowId,
  onUpdate,
}: {
  node: ReturnType<typeof getNodeById>
  workflowName?: string
  workflowId: string | null
  onUpdate: (patch: { name?: string; config?: Record<string, unknown> }) => void
}) {
  if (!node || !workflowId) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a node on the canvas to edit its config.
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      <div className="space-y-1 border-b border-border/80 pb-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {formatNodeType(node.type)}
        </div>
        <h2 className="text-sm font-semibold text-foreground">{node.name}</h2>
        {workflowName ? (
          <p className="text-[11px] text-muted-foreground truncate">{workflowName}</p>
        ) : null}
      </div>
      <BlockEditorForm
        node={node}
        onNameChange={(name) => onUpdate({ name })}
        onConfigChange={(key, value) => onUpdate({ config: { [key]: value } })}
      />
      <p className="text-[11px] text-muted-foreground pt-1">
        Changes save to craft-modules via <code className="text-[10px]">workflows:update</code>.
      </p>
    </div>
  )
}
