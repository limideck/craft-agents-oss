import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MORE_READING_TASKS, PRIMARY_READING_TASKS, type ReadingTask } from './reading-tasks'

type ReadingChipsProps = {
  onSelect: (task: ReadingTask) => void
  disabled?: boolean
}

/**
 * Horizontal analysis chips (图一 top): 总结要点 / 结构拆解 / … / 翻译 / …
 */
export function ReadingChips({ onSelect, disabled }: ReadingChipsProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className="relative mb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRIMARY_READING_TASKS.map((task) => (
          <button
            key={task.id}
            type="button"
            disabled={disabled}
            className={cn(
              'h-7 rounded-full border border-border/80 bg-foreground-5 px-3 text-[11px] text-foreground/80',
              'hover:bg-foreground-10 hover:text-foreground disabled:opacity-50',
            )}
            onClick={() => onSelect(task)}
          >
            {task.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-foreground-5 text-muted-foreground',
            'hover:bg-foreground-10 hover:text-foreground disabled:opacity-50',
          )}
          aria-label="更多分析"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {moreOpen ? (
        <div className="absolute left-0 top-full z-10 mt-1.5 flex min-w-[160px] flex-col gap-0.5 rounded-lg border border-border bg-background p-1 shadow-[var(--shadow-modal-small)]">
          {MORE_READING_TASKS.map((task) => (
            <button
              key={task.id}
              type="button"
              className="rounded-md px-2.5 py-1.5 text-left text-[11px] text-foreground/80 hover:bg-foreground-5"
              onClick={() => {
                setMoreOpen(false)
                onSelect(task)
              }}
            >
              {task.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
