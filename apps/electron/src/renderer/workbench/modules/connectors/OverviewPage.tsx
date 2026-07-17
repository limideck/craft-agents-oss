import type { AppData } from './model'
import type { ReactNode } from 'react'
import { Activity, ArrowRight, Cable, RefreshCw, TerminalSquare } from 'lucide-react'
import { createOverviewSummary, sortProviders } from './model'
import { Badge, EmptyState, ProviderIcon } from './shared-ui'
import { Button } from '@/components/ui/button'

interface OverviewPageProps {
  data: AppData
  runtimeReady: boolean
  onRefresh(): void
  onNavigateProviders(): void
  onNavigateActions(): void
  onNavigateRuns(): void
}

export function OverviewPage(props: OverviewPageProps): ReactNode {
  const summary = createOverviewSummary(props.data)
  const connectionsByService = new Map(props.data.connections.map((c) => [c.service, c]))
  const topProviders = sortProviders(props.data.providers, connectionsByService).slice(0, 4)

  const cells = [
    {
      key: 'providers',
      icon: Cable,
      label: 'Providers',
      value: String(summary.providerCount),
      meta: 'Available services',
      badge: summary.providerCount > 0 ? 'Ready' : 'Unavailable',
      tone: summary.providerCount > 0 ? ('success' as const) : ('warning' as const),
      onClick: props.onNavigateProviders,
    },
    {
      key: 'actions',
      icon: TerminalSquare,
      label: 'Executable actions',
      value: String(summary.locallyExecutableActionCount),
      meta: 'Locally runnable',
      badge: summary.locallyExecutableActionCount > 0 ? 'Ready' : 'Unavailable',
      tone: summary.locallyExecutableActionCount > 0 ? ('success' as const) : ('warning' as const),
      onClick: props.onNavigateActions,
    },
    {
      key: 'runs',
      icon: Activity,
      label: 'Run health',
      value: String(summary.failedRunCount),
      meta: 'Recent failures',
      badge: summary.failedRunCount === 0 ? 'Ready' : 'Needs attention',
      tone: summary.failedRunCount === 0 ? ('success' as const) : ('warning' as const),
      onClick: props.onNavigateRuns,
    },
  ]

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div className="flex items-center justify-between gap-3 rounded-[8px] border border-border/40 bg-background px-4 py-3 shadow-minimal">
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {props.runtimeReady ? 'Runtime ready' : 'Runtime offline'}
          </div>
          <div className="text-sm text-muted-foreground">
            {summary.connectedCount} connected provider{summary.connectedCount === 1 ? '' : 's'}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={props.onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <section className="rounded-[8px] border border-border/40 bg-background p-4 shadow-minimal">
        <h2 className="mb-3 text-base font-semibold">Capability status</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {cells.map((cell) => {
            const Icon = cell.icon
            return (
              <button
                key={cell.key}
                type="button"
                onClick={cell.onClick}
                className="flex flex-col gap-2 rounded-[8px] border border-border/30 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">{cell.label}</span>
                  </div>
                  <Badge tone={cell.tone}>{cell.badge}</Badge>
                </div>
                <div className="text-2xl font-semibold tabular-nums">{cell.value}</div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{cell.meta}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
                {cell.key === 'providers' && topProviders.length > 0 ? (
                  <div className="mt-1 flex -space-x-1.5">
                    {topProviders.map((provider) => (
                      <span key={provider.service} className="rounded-md ring-2 ring-background">
                        <ProviderIcon provider={provider} />
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-[8px] border border-border/40 bg-background p-4 shadow-minimal">
        <h2 className="mb-3 text-base font-semibold">Recent failures</h2>
        {summary.failedRuns.length === 0 ? (
          <EmptyState
            title="No recent failures"
            description="Action runs look healthy. Connect a provider and try an action to see activity here."
            icon={null}
          />
        ) : (
          <div className="divide-y divide-border/30">
            {summary.failedRuns.map((run) => (
              <div key={run.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{run.actionId}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {run.errorMessage ?? run.errorCode ?? 'Failed'}
                  </div>
                </div>
                <Badge tone="error">Failed</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
