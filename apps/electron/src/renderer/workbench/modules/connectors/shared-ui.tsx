import type { ProviderDefinition } from './model'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { CircleAlert, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge as UiBadge } from '@/components/ui/badge'

export function Badge(props: { children: ReactNode; tone?: 'success' | 'warning' | 'error' }): ReactNode {
  return (
    <UiBadge
      variant={props.tone === 'error' ? 'destructive' : 'outline'}
      className={cn(
        'text-[11px] font-medium',
        props.tone === 'success' && 'border-success/40 text-success',
        props.tone === 'warning' && 'border-amber-500/40 text-amber-600 dark:text-amber-400',
      )}
    >
      {props.children}
    </UiBadge>
  )
}

export function TagList(props: { values: string[]; empty: string }): ReactNode {
  const values = props.values.filter(Boolean)
  if (values.length === 0) return <p className="text-sm text-muted-foreground">{props.empty}</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
        >
          {value}
        </span>
      ))}
    </div>
  )
}

export function ProviderIcon(props: { provider: ProviderDefinition; large?: boolean }): ReactNode {
  const letters = providerInitials(props.provider.displayName)
  const iconUrl = props.provider.iconUrl?.trim() || faviconUrl(props.provider.homepageUrl)
  const [failed, setFailed] = useState(false)
  const size = props.large ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs'

  if (!iconUrl || failed) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground',
          size,
        )}
      >
        {letters}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex shrink-0 overflow-hidden rounded-lg bg-muted', size)}>
      <img
        alt=""
        className="h-full w-full object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={iconUrl}
        onError={() => setFailed(true)}
      />
    </span>
  )
}

function providerInitials(displayName: string): string {
  return (
    displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

function faviconUrl(homepageUrl: string | undefined): string | undefined {
  if (!homepageUrl) return undefined
  try {
    const hostname = new URL(homepageUrl).hostname
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostname)}`
  } catch {
    return undefined
  }
}

export function EmptyState(props: {
  title: string
  description: string
  icon?: ReactNode | null
}): ReactNode {
  const icon = props.icon === undefined ? <Inbox className="h-5 w-5 text-muted-foreground" /> : props.icon
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon}
      <strong className="text-sm font-medium">{props.title}</strong>
      <p className="max-w-sm text-sm text-muted-foreground">{props.description}</p>
    </div>
  )
}

export function InlineError(props: { message: string }): ReactNode {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{props.message}</span>
    </div>
  )
}

export function FormStatus(props: { message: string }): ReactNode {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground" role="status">
      {props.message}
    </div>
  )
}

export function StatusDot(props: { ok: boolean; starting?: boolean }): ReactNode {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        props.ok ? 'bg-success' : props.starting ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground/40',
      )}
    />
  )
}
