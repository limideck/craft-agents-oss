import type { ReactNode, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared chrome for ActivityBar module side rails.
 * Header uses --workbench-chrome-height (px) to match `.dv-tabs-and-actions-container`.
 * Do not use rem-based utilities (h-10) here — html font-size is 15px, so 2.5rem ≠ 40px.
 * Keep dock-panel toolbars on PanelHeaderBar (30px) — in-panel density, not the seam.
 */

const ACTIVITY_ACTION_CURSOR_CLASS =
  '[&_button:not(:disabled)]:cursor-pointer [&_[role=button]:not([aria-disabled=true])]:cursor-pointer'

type ActivityShellProps = {
  title: ReactNode
  actions?: ReactNode
  /** Optional strip below the chrome title bar (filters, segments). */
  toolbar?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** When false, body does not scroll (caller manages overflow). Default true. */
  scroll?: boolean
}

export function ActivityShell({
  title,
  actions,
  toolbar,
  children,
  className,
  bodyClassName,
  scroll = true,
}: ActivityShellProps) {
  return (
    <div className={cn('h-full flex flex-col min-h-0 bg-background', className)}>
      <ActivityHeaderBar>
        <span className="truncate min-w-0">{title}</span>
        <div className="flex-1" />
        {actions ? <div className="flex items-center gap-1.5 shrink-0">{actions}</div> : null}
      </ActivityHeaderBar>
      {toolbar ? <div className="shrink-0 border-b border-border">{toolbar}</div> : null}
      <div
        className={cn(
          'flex-1 min-h-0 bg-background',
          scroll && 'overflow-auto',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}

type ActivityHeaderBarProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode
}

/**
 * Activity chrome header — outer geometry must match `.dv-tabs-and-actions-container`:
 * border-box, height = var(--workbench-chrome-height), 1px border-b inside that height.
 * Height/border come from `.workbench-chrome-header` (index.css), not rem utilities.
 */
export function ActivityHeaderBar({ children, className, ...rest }: ActivityHeaderBarProps) {
  return (
    <div
      className={cn(
        'workbench-chrome-header flex items-center gap-1.5 px-2.5 shrink-0',
        'bg-background text-xs leading-none font-medium text-foreground',
        ACTIVITY_ACTION_CURSOR_CLASS,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
