import { forwardRef, type ReactNode, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Reusable dockview panel layout primitives.
 *
 * PanelRoot — outermost wrapper, fills the dockview content area
 * PanelBody — scrollable (or non-scrollable) content region
 * PanelToolbar / PanelHeaderBar — fixed header strip
 */

const PANEL_ROOT_CLASS = 'h-full min-h-0 flex flex-col bg-card text-card-foreground'
const PANEL_BAR_CLASS =
  'flex items-center gap-1.5 h-[30px] px-2.5 shrink-0 border-border/80 bg-card/95 text-xs text-foreground'
const PANEL_ACTION_CURSOR_CLASS =
  '[&_button:not(:disabled)]:cursor-pointer [&_[role=button]:not([aria-disabled=true])]:cursor-pointer'

type PanelRootProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  className?: string
}

export const PanelRoot = forwardRef<HTMLDivElement, PanelRootProps>(function PanelRoot(
  { children, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn(PANEL_ROOT_CLASS, className)} {...rest}>
      {children}
    </div>
  )
})

type PanelBodyProps = Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {
  children: ReactNode
  className?: string
  padding?: boolean
  scroll?: boolean
}

export const PanelBody = forwardRef<HTMLDivElement, PanelBodyProps>(function PanelBody(
  { children, className, padding = true, scroll = true, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex-1 min-h-0 bg-card text-card-foreground',
        scroll && 'overflow-auto',
        padding && 'p-2.5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
})

type PanelToolbarProps = {
  children: ReactNode
  className?: string
}

type PanelBarProps = {
  children?: ReactNode
  className?: string
  borderClassName: 'border-b' | 'border-t'
}

function PanelBar({ children, className, borderClassName }: PanelBarProps) {
  return (
    <div className={cn(PANEL_BAR_CLASS, PANEL_ACTION_CURSOR_CLASS, borderClassName, className)}>
      {children}
    </div>
  )
}

export function PanelToolbar({ children, className }: PanelToolbarProps) {
  return <PanelHeaderBar className={className}>{children}</PanelHeaderBar>
}

type PanelHeaderBarProps = {
  children?: ReactNode
  className?: string
}

export function PanelHeaderBar({ children, className }: PanelHeaderBarProps) {
  return (
    <PanelBar borderClassName="border-b" className={className}>
      {children}
    </PanelBar>
  )
}

type PanelHeaderBarSplitProps = {
  left?: ReactNode
  right?: ReactNode
  className?: string
}

export function PanelHeaderBarSplit({ left, right, className }: PanelHeaderBarSplitProps) {
  return (
    <PanelHeaderBar className={className}>
      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">{left}</div>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 shrink-0">{right}</div>
    </PanelHeaderBar>
  )
}

export function PanelFooterBar({ children, className }: PanelHeaderBarProps) {
  return (
    <PanelBar borderClassName="border-t" className={className}>
      {children}
    </PanelBar>
  )
}
