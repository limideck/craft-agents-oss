import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { ACCENT_BORDER, ACCENT_ICON, getBlockConfig, getNodeIcon } from '../blocks'
import type { WorkflowNodeRunStatus, WorkflowNodeType } from '../mock/types'

export type WorkflowCanvasNodeData = {
  type: WorkflowNodeType
  name: string
  runStatus?: WorkflowNodeRunStatus
}

const BRANCH_HANDLES = new Set([
  'true',
  'false',
  'pass',
  'drop',
  'approved',
  'rejected',
  'item',
  'done',
  'default',
  'case0',
  'case1',
  'billing',
  'support',
  'other',
])

function handleLabel(id: string): string | null {
  if (BRANCH_HANDLES.has(id) || id.startsWith('case')) return id
  return null
}

function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowCanvasNodeData
  const block = getBlockConfig(nodeData.type)
  const targets = block.handles.target ?? []
  const sources = block.handles.source
  const runStatus = nodeData.runStatus ?? 'idle'
  const Icon = getNodeIcon(nodeData.type)
  const accent = block.accent
  const showBranchLabels = sources.some((id) => handleLabel(id))

  return (
    <div
      className={cn(
        'relative w-[168px] rounded-md border border-l-[3px] bg-card px-2.5 py-2 shadow-sm',
        'transition-[box-shadow,border-color]',
        ACCENT_BORDER[accent] ?? 'border-l-muted-foreground',
        selected
          ? 'border-foreground ring-1 ring-foreground/20'
          : 'border-border',
        runStatus === 'success' && 'ring-2 ring-emerald-500/70 border-emerald-500/50',
        runStatus === 'error' && 'ring-2 ring-red-500/70 border-red-500/50',
        runStatus === 'running' && 'ring-2 ring-sky-500/70 border-sky-500/50',
      )}
    >
      {targets.map((id, i) => (
        <Handle
          key={`t-${id}`}
          id={id}
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-border !bg-muted-foreground"
          style={
            targets.length > 1
              ? { top: `${((i + 1) / (targets.length + 1)) * 100}%` }
              : undefined
          }
        />
      ))}

      <div className="flex items-center gap-1.5">
        <Icon className={cn('size-3.5 shrink-0', ACCENT_ICON[accent] ?? 'text-muted-foreground')} />
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
          {block.label}
        </div>
      </div>
      <div className="mt-0.5 text-sm font-medium truncate text-foreground">{nodeData.name}</div>

      {sources.map((id, i) => {
        const label = handleLabel(id)
        const multi = sources.length > 1
        const positive =
          id === 'true' || id === 'pass' || id === 'approved' || id === 'item' || id === 'done'
        const negative = id === 'false' || id === 'drop' || id === 'rejected'
        return (
          <Handle
            key={`s-${id}`}
            id={id}
            type="source"
            position={Position.Right}
            className={cn(
              '!h-2.5 !w-2.5 !border-border',
              positive && '!bg-emerald-500',
              negative && '!bg-red-500',
              !positive && !negative && '!bg-muted-foreground',
            )}
            style={
              multi
                ? { top: `${((i + 1) / (sources.length + 1)) * 100}%` }
                : undefined
            }
            title={label ?? undefined}
          />
        )
      })}

      {showBranchLabels ? (
        <div className="pointer-events-none absolute -right-1 top-0 flex h-full flex-col justify-around py-1 pr-0 text-[8px] font-medium uppercase text-muted-foreground">
          {sources.map((id) => (
            <span
              key={id}
              className={cn(
                'translate-x-full pl-1 max-w-[52px] truncate',
                (id === 'true' || id === 'pass' || id === 'approved') &&
                  'text-emerald-600 dark:text-emerald-400',
                (id === 'false' || id === 'drop' || id === 'rejected') &&
                  'text-red-600 dark:text-red-400',
              )}
            >
              {handleLabel(id)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export const WorkflowCanvasNode = memo(WorkflowNodeComponent)
