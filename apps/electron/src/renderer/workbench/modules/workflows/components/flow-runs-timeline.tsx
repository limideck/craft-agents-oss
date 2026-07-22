/**
 * FlowRunsTimeline
 *
 * Renders the shared run history for a single workflow. Rows come from the same
 * per-workspace `automations-history.jsonl` store the Automations Rules UI reads,
 * discriminated by `kind: 'flow'`. Manual runs and auto-fired (schedule/webhook)
 * runs both land here because they all flow through `workflows:run`.
 */

import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FlowRunEntry } from '../use-workflow-data'

function formatShortRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return new Date(ts).toLocaleDateString()
}

export function FlowRunsTimeline({
  entries,
  loading,
}: {
  entries: FlowRunEntry[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        Loading runs…
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No runs yet. Trigger a run to populate history.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/30">
      {entries.map((entry) => {
        const StatusIcon = entry.ok ? CheckCircle2 : XCircle
        const statusClass = entry.ok ? 'text-success' : 'text-destructive'
        return (
          <div
            key={entry.runId}
            className="flex items-start gap-3 px-4 py-2.5 text-sm"
          >
            <StatusIcon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', statusClass)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums">
                  {formatShortRelativeTime(entry.ts)}
                </span>
                <span className="truncate text-xs text-foreground/80">
                  {entry.summary || (entry.ok ? 'Run completed' : 'Run failed')}
                </span>
              </div>
              {entry.error ? (
                <p className="mt-0.5 truncate text-[11px] text-destructive/80 font-mono">
                  {entry.error}
                </p>
              ) : null}
              <p className="mt-0.5 text-[10px] text-muted-foreground/70 font-mono truncate">
                {entry.runId}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
