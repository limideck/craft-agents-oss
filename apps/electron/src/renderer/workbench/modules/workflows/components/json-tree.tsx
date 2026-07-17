import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type ValueType = 'null' | 'undefined' | 'array' | 'string' | 'number' | 'boolean' | 'object'

const TYPE_BADGE: Record<ValueType, string> = {
  string: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  number: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  boolean: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
  array: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  object: 'bg-foreground-10 text-muted-foreground',
  null: 'bg-foreground-5 text-muted-foreground',
  undefined: 'bg-foreground-5 text-muted-foreground',
}

function getType(value: unknown): ValueType {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  return typeof value as ValueType
}

function formatPrimitive(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

function isExpandable(value: unknown): boolean {
  return value !== null && typeof value === 'object'
}

function summary(value: unknown): string {
  if (Array.isArray(value)) {
    const n = value.length
    return `${n} item${n === 1 ? '' : 's'}`
  }
  if (value !== null && typeof value === 'object') {
    const n = Object.keys(value as object).length
    return `${n} key${n === 1 ? '' : 's'}`
  }
  return ''
}

function TypeBadge({ type }: { type: ValueType }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1 py-px text-[10px] font-medium leading-none tabular-nums',
        TYPE_BADGE[type],
      )}
    >
      {type}
    </span>
  )
}

function JsonNode({
  name,
  value,
  depth,
  defaultOpen,
}: {
  name: string
  value: unknown
  depth: number
  defaultOpen: boolean
}) {
  const type = getType(value)
  const expandable = isExpandable(value)
  const [open, setOpen] = useState(defaultOpen && depth < 2)

  if (!expandable) {
    return (
      <div
        className="flex min-h-[26px] items-center gap-2 rounded px-1.5 -mx-1.5 hover:bg-foreground-5"
        style={{ paddingLeft: depth * 12 + 6 }}
      >
        <span className="w-3 shrink-0" />
        <span className="truncate text-foreground">{name}</span>
        <TypeBadge type={type} />
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          {formatPrimitive(value)}
        </span>
      </div>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>)

  return (
    <div>
      <button
        type="button"
        className="flex w-full min-h-[26px] items-center gap-2 rounded px-1.5 -mx-1.5 text-left hover:bg-foreground-5"
        style={{ paddingLeft: depth * 12 + 6 }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="truncate text-foreground">{name}</span>
        <TypeBadge type={type} />
        {!open && (
          <span className="truncate text-[11px] text-muted-foreground">{summary(value)}</span>
        )}
      </button>
      {open &&
        entries.map(([k, v]) => (
          <JsonNode key={k} name={k} value={v} depth={depth + 1} defaultOpen={depth < 1} />
        ))}
    </div>
  )
}

/** Expandable structured JSON tree with type tags (Sim-inspired, Craft tokens). */
export function JsonTree({ data, className }: { data: unknown; className?: string }) {
  if (data === undefined) {
    return <div className={cn('p-3 text-sm text-muted-foreground', className)}>No data</div>
  }

  if (!isExpandable(data)) {
    return (
      <div className={cn('flex items-center gap-2 p-3 font-mono text-[11px]', className)}>
        <TypeBadge type={getType(data)} />
        <span className="text-foreground">{formatPrimitive(data)}</span>
      </div>
    )
  }

  const entries = Array.isArray(data)
    ? data.map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>)

  if (entries.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 p-3', className)}>
        <TypeBadge type={getType(data)} />
        <span className="text-sm text-muted-foreground">{Array.isArray(data) ? '[]' : '{}'}</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-0.5 p-2 text-xs', className)}>
      {entries.map(([k, v]) => (
        <JsonNode key={k} name={k} value={v} depth={0} defaultOpen />
      ))}
    </div>
  )
}
