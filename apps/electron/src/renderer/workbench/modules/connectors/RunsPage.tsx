import type { AppData, RunLog } from './model'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createOpenConnectorClient, fetchRunsPage, type OpenConnectorConfig } from './api'
import { compactJson, formatDate, formatDuration } from './model'
import { Badge, EmptyState, InlineError } from './shared-ui'
import { Button } from '@/components/ui/button'

interface RunsPageProps {
  data: AppData
  config: OpenConnectorConfig | null
}

export function RunsPage(props: RunsPageProps): ReactNode {
  const [runs, setRuns] = useState(props.data.runs)
  const [nextCursor, setNextCursor] = useState(props.data.runsNextCursor)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)
  const serviceLoadRequestId = useRef(0)

  const serviceOptions = useMemo(() => runServiceOptions(selectedService ? props.data.runs : runs), [
    props.data.runs,
    runs,
    selectedService,
  ])

  useEffect(() => {
    setRuns(props.data.runs)
    setNextCursor(props.data.runsNextCursor)
    setRunsError(null)
  }, [props.data.runs, props.data.runsNextCursor])

  async function loadMoreRuns(): Promise<void> {
    if (!nextCursor || loadingMore || !props.config) return
    setLoadingMore(true)
    setRunsError(null)
    try {
      const client = createOpenConnectorClient(props.config)
      const page = await fetchRunsPage(client, props.config.adminToken, {
        cursor: nextCursor,
        service: selectedService,
      })
      setRuns((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
    } catch (caught) {
      setRunsError(caught instanceof Error ? caught.message : 'Failed to load more runs')
    } finally {
      setLoadingMore(false)
    }
  }

  async function loadRunsForService(service: string | null, requestId: number): Promise<void> {
    if (!props.config) return
    setLoadingMore(true)
    try {
      const client = createOpenConnectorClient(props.config)
      const page = await fetchRunsPage(client, props.config.adminToken, { service })
      if (requestId !== serviceLoadRequestId.current) return
      setRuns(page.items)
      setNextCursor(page.nextCursor)
    } catch (caught) {
      if (requestId !== serviceLoadRequestId.current) return
      setRunsError(caught instanceof Error ? caught.message : 'Failed to load runs')
    } finally {
      if (requestId === serviceLoadRequestId.current) setLoadingMore(false)
    }
  }

  function selectService(value: string): void {
    const service = value || null
    setSelectedService(service)
    setRunsError(null)
    if (!service) {
      serviceLoadRequestId.current += 1
      setRuns(props.data.runs)
      setNextCursor(props.data.runsNextCursor)
      setLoadingMore(false)
      return
    }
    void loadRunsForService(service, ++serviceLoadRequestId.current)
  }

  if (props.data.runs.length === 0 && !selectedService) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          title="No runs yet"
          description="Execute an action from Providers or Actions to see history here."
          icon={null}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Service</span>
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          value={selectedService ?? ''}
          onChange={(event) => selectService(event.target.value)}
          disabled={loadingMore}
        >
          <option value="">All services</option>
          {serviceOptions.map((option) => (
            <option key={option.service} value={option.service}>
              {option.service} ({option.count})
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border border-border/40 bg-background shadow-minimal">
        {runs.length === 0 ? (
          <EmptyState title="No runs" description="No runs for this service filter." icon={null} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Caller</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Input</th>
                <th className="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-border/20 align-top">
                  <td className="px-3 py-2 font-mono text-xs">{run.actionId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{run.caller}</td>
                  <td className="px-3 py-2">
                    {run.ok ? <Badge tone="success">Success</Badge> : <Badge tone="error">Failed</Badge>}
                  </td>
                  <td className="px-3 py-2 text-xs">{formatDate(run.startedAt)}</td>
                  <td className="px-3 py-2 text-xs">{formatDuration(run)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs">
                    {compactJson(run.inputSummary)}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground">
                    {run.errorMessage ?? run.errorCode ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {runsError ? <InlineError message={runsError} /> : null}
      {nextCursor ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => void loadMoreRuns()} disabled={loadingMore || !props.config}>
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function runServiceOptions(runs: RunLog[]): Array<{ service: string; count: number }> {
  const counts = new Map<string, number>()
  for (const run of runs) {
    counts.set(run.service, (counts.get(run.service) ?? 0) + 1)
  }
  return [...counts.entries()].map(([service, count]) => ({ service, count }))
}
