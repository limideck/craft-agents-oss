import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { cn } from '@/lib/utils'
import { JsonTree } from '../components/json-tree'
import { formatNodeType, getNodeIcon } from '../blocks'
import type { WorkflowNodeType, WorkflowRunStep } from '../mock/types'
import {
  selectedLogStepIdAtom,
  selectedNodeIdAtom,
  workflowLogsAtom,
  workflowRunStepsAtom,
} from '../store'

type DetailTab = 'output' | 'input'

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function StepRow({
  step,
  selected,
  onSelect,
}: {
  step: WorkflowRunStep
  selected: boolean
  onSelect: () => void
}) {
  const Icon = getNodeIcon(step.nodeType)
  const hasError = step.status === 'error' || Boolean(step.error)

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        'flex h-[30px] w-full items-center gap-2 px-2.5 text-left text-xs',
        'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
        selected && 'bg-foreground-10',
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-sm',
          hasError ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-foreground-10 text-muted-foreground',
        )}
        title={formatNodeType(String(step.nodeType))}
      >
        <Icon className="size-2.5" />
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          hasError ? 'text-red-600 dark:text-red-400' : 'text-foreground',
        )}
      >
        {step.name}
      </span>
      {hasError && <AlertCircle className="size-3 shrink-0 text-red-500" aria-hidden />}
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {step.status === 'running' ? '…' : formatDuration(step.durationMs)}
      </span>
    </button>
  )
}

function DetailPane({ step }: { step: WorkflowRunStep | null }) {
  const [tab, setTab] = useState<DetailTab>('output')

  useEffect(() => {
    setTab('output')
  }, [step?.id])

  if (!step) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Select a step to inspect Input / Output
      </div>
    )
  }

  const data = tab === 'output' ? step.output : step.input
  const showError = tab === 'output' && step.error

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border px-2">
        {(['output', 'input'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              'rounded px-2 py-1 text-xs capitalize',
              'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
              tab === id ? 'bg-foreground-10 font-medium text-foreground' : 'text-muted-foreground',
            )}
            onClick={() => setTab(id)}
          >
            {id === 'output' ? 'Output' : 'Input'}
          </button>
        ))}
        <span className="ml-auto truncate text-[10px] text-muted-foreground" title={step.nodeId}>
          {formatNodeType(String(step.nodeType as WorkflowNodeType))}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {showError ? (
          <div className="space-y-2 p-3">
            <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-700 dark:text-red-400">
              {step.error}
            </div>
            <JsonTree data={data} />
          </div>
        ) : (
          <JsonTree data={data} />
        )}
      </div>
    </div>
  )
}

/**
 * Bottom Logs panel — Sim-style step list + Output | Input JSON tree.
 */
export function LogsPanel() {
  const steps = useAtomValue(workflowRunStepsAtom)
  const sessionLogs = useAtomValue(workflowLogsAtom)
  const [selectedStepId, setSelectedStepId] = useAtom(selectedLogStepIdAtom)
  const setSelectedNodeId = useSetAtom(selectedNodeIdAtom)

  const selected =
    steps.find((s) => s.id === selectedStepId) ?? steps[0] ?? null

  useEffect(() => {
    if (steps.length === 0) {
      setSelectedStepId(null)
      return
    }
    if (!selectedStepId || !steps.some((s) => s.id === selectedStepId)) {
      setSelectedStepId(steps[0]!.id)
    }
  }, [steps, selectedStepId, setSelectedStepId])

  const onSelectStep = (step: WorkflowRunStep) => {
    setSelectedStepId(step.id)
    setSelectedNodeId(step.nodeId)
  }

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between">
        <span className="font-medium truncate">Logs</span>
        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
          {steps.length > 0 ? `${steps.length} step${steps.length === 1 ? '' : 's'}` : sessionLogs.length}
        </span>
      </PanelHeaderBar>
      <PanelBody padding={false} scroll={false} className="p-0">
        {steps.length === 0 ? (
          <div className="flex h-full min-h-[80px] flex-col">
            <div className="p-3 text-sm text-muted-foreground">
              No run steps yet. Click <span className="font-medium text-foreground">Run</span> to
              simulate per-node Input / Output.
            </div>
            {sessionLogs.length > 0 && (
              <ul className="border-t border-border py-1 font-mono text-[11px]" aria-label="Session logs">
                {sessionLogs.slice(-8).map((line) => (
                  <li
                    key={line.id}
                    className={cn(
                      'px-3 py-1 border-b border-border/40 last:border-0',
                      line.level === 'warn' && 'text-amber-700 dark:text-amber-400',
                      line.level === 'info' && 'text-muted-foreground',
                    )}
                  >
                    {line.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
            <ResizablePanel defaultSize={42} minSize={28} className="min-w-0">
              <div
                className="h-full overflow-auto"
                role="listbox"
                aria-label="Run steps"
              >
                {steps.map((step) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    selected={selected?.id === step.id}
                    onSelect={() => onSelectStep(step)}
                  />
                ))}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-border" />
            <ResizablePanel defaultSize={58} minSize={35} className="min-w-0">
              <DetailPane step={selected} />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
