import * as React from 'react'
import * as Sentry from '@sentry/electron/renderer'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PanelErrorBoundaryProps {
  /** Stable key that resets the boundary when it changes (e.g. selected site id). */
  resetKey?: string
  /** Human-readable panel name for the error log + message. */
  panelName: string
  children: React.ReactNode
}

interface PanelErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Contains a single workbench panel's render crash so it cannot propagate to the
 * root Sentry.ErrorBoundary (whose fallback calls window.location.reload() — i.e.
 * the whole app "restarts"). Used by fragile panels like Sites that embed heavy
 * subtrees (ChatPage) which may throw on mount for certain session/project states.
 */
export class PanelErrorBoundary extends React.Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PanelErrorBoundary] ${this.props.panelName} crashed:`, error)
    Sentry.captureException(error, {
      tags: { errorSource: 'workbench-panel', panel: this.props.panelName },
      extra: { componentStack: info.componentStack },
    })
  }

  componentDidUpdate(prevProps: PanelErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  private retry = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <PanelErrorFallback panelName={this.props.panelName} onRetry={this.retry} />
    )
  }
}

function PanelErrorFallback({
  panelName,
  onRetry,
}: {
  panelName: string
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
      <div className="rounded-full bg-destructive/10 p-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <p className="font-medium text-foreground/80">{panelName}</p>
      <p className="text-xs">{t('workbench.panelCrashed')}</p>
      <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        {t('common.retry')}
      </Button>
    </div>
  )
}
