import type { ReactNode } from 'react'
import { Loader2, RefreshCw, RotateCw } from 'lucide-react'
import { useOpenConnectorRuntime } from './useOpenConnectorRuntime'
import { OverviewPage } from './OverviewPage'
import { ProvidersPage } from './ProvidersPage'
import { ActionsPage } from './ActionsPage'
import { RunsPage } from './RunsPage'
import { AccessPage } from './AccessPage'
import { InlineError, StatusDot } from './shared-ui'
import { Button } from '@/components/ui/button'
import { PanelHeader } from '@/components/ui/panel-header'
import type { OpenConnectorSection } from './types'
import { PanelRoot, PanelBody } from '../../dock/panel-primitives'

interface OpenConnectorPageProps {
  section: OpenConnectorSection
  selectedService: string | null
  selectedActionId: string | null
  onNavigateSection: (section: OpenConnectorSection) => void
  onSelectService: (service: string | null) => void
  onSelectAction: (actionId: string | null) => void
}

export function OpenConnectorPage(props: OpenConnectorPageProps): ReactNode {
  const runtime = useOpenConnectorRuntime(true)
  const ready = runtime.status?.ready === true
  const starting = runtime.status?.starting === true

  const title =
    props.section === 'overview'
      ? 'Overview'
      : props.section === 'providers'
        ? 'Providers'
        : props.section === 'actions'
          ? 'Actions'
          : props.section === 'runs'
            ? 'Runs'
            : 'Access & Docs'

  return (
    <PanelRoot>
      <PanelHeader
        title={title}
        badge={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusDot ok={ready} starting={starting} />
            {ready ? 'Runtime ready' : starting ? 'Starting…' : 'Offline'}
          </span>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void runtime.refresh()}
              title="Refresh"
            >
              {runtime.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void runtime.restart()}
              title="Restart runtime"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {runtime.error ? (
        <div className="px-6 pt-4">
          <InlineError message={runtime.error} />
        </div>
      ) : null}

      <PanelBody padding={false} scroll className="min-h-0 flex-1">
        {props.section === 'overview' ? (
          <OverviewPage
            data={runtime.data}
            runtimeReady={ready}
            onRefresh={() => void runtime.refresh()}
            onNavigateProviders={() => props.onNavigateSection('providers')}
            onNavigateActions={() => props.onNavigateSection('actions')}
            onNavigateRuns={() => props.onNavigateSection('runs')}
          />
        ) : null}
        {props.section === 'providers' ? (
          <ProvidersPage
            data={runtime.data}
            config={runtime.config}
            selectedService={props.selectedService}
            onSelectService={props.onSelectService}
            onSelectAction={(actionId) => {
              props.onSelectAction(actionId)
              props.onNavigateSection('actions')
            }}
            onRefresh={() => void runtime.refresh()}
          />
        ) : null}
        {props.section === 'actions' ? (
          <ActionsPage
            data={runtime.data}
            config={runtime.config}
            selectedActionId={props.selectedActionId}
            onSelectAction={props.onSelectAction}
            onSelectProvider={(service) => {
              props.onSelectService(service)
              props.onNavigateSection('providers')
            }}
            onRefresh={() => void runtime.refresh()}
          />
        ) : null}
        {props.section === 'runs' ? (
          <RunsPage data={runtime.data} config={runtime.config} />
        ) : null}
        {props.section === 'access' ? (
          <AccessPage
            data={runtime.data}
            config={runtime.config}
            onRefresh={() => void runtime.refresh()}
          />
        ) : null}
      </PanelBody>
    </PanelRoot>
  )
}
