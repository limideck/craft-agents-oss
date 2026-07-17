import type {
  AppData,
  AuthDefinition,
  CredentialField,
  OAuthConfig,
  ProviderConnectionStatus,
  ProviderDefinition,
} from './model'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Cable,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  KeyRound,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import {
  createOpenConnectorClient,
  deleteConnection,
  deleteOAuthConfig,
  putConnection,
  putOAuthConfig,
  startOAuthAuthorization,
  type OpenConnectorConfig,
} from './api'
import {
  credentialFieldsFor,
  filterProviders,
  resolveProviderConnectionStatus,
  sortProviders,
} from './model'
import { Badge, EmptyState, FormStatus, ProviderIcon, TagList } from './shared-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ProviderStatusFilter = 'all' | 'connected' | 'not_connected' | 'oauth_needs_config'

const providerPageSize = 48
const oauthRefreshPollingIntervalMs = 1_000
const oauthRefreshPollingMaxAttempts = 30

interface ProvidersPageProps {
  data: AppData
  config: OpenConnectorConfig | null
  selectedService: string | null
  onSelectService: (service: string | null) => void
  onSelectAction: (actionId: string) => void
  onRefresh(): void
}

export function ProvidersPage(props: ProvidersPageProps): ReactNode {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProviderStatusFilter>('all')
  const resetKey = `${query}::${statusFilter}`

  const statusByService = useMemo(
    () =>
      new Map(
        props.data.providers.map((provider) => [
          provider.service,
          resolveProviderConnectionStatus(provider, props.data.connections, props.data.oauthConfigs),
        ]),
      ),
    [props.data.connections, props.data.oauthConfigs, props.data.providers],
  )

  const credentialConnectionsByService = useMemo(
    () =>
      new Map(
        [...statusByService.entries()].flatMap(([service, status]) =>
          status.connection ? [[service, status.connection] as const] : [],
        ),
      ),
    [statusByService],
  )

  const sortedProviders = useMemo(
    () => sortProviders(props.data.providers, credentialConnectionsByService),
    [credentialConnectionsByService, props.data.providers],
  )
  const searchedProviders = filterProviders(sortedProviders, query)
  const visibleProviders = filterProvidersByStatus(searchedProviders, statusFilter, statusByService)
  const { hasMore, limit, loadMore, ensureVisible } = useProgressiveProviderLimit(
    visibleProviders.length,
    resetKey,
  )
  const loadMoreRef = useIntersectionLoader(hasMore, loadMore)
  const renderedProviders = visibleProviders.slice(0, limit)
  const filtersActive = query.trim().length > 0 || statusFilter !== 'all'

  useEffect(() => {
    if (!props.selectedService) return
    const selectedIndex = visibleProviders.findIndex(
      (provider) => provider.service === props.selectedService,
    )
    if (selectedIndex >= 0) ensureVisible(selectedIndex)
  }, [ensureVisible, props.selectedService, visibleProviders])

  const statusCounts = useMemo(
    () =>
      (
        [
          { id: 'all' as const, label: 'All' },
          { id: 'connected' as const, label: 'Connected' },
          { id: 'not_connected' as const, label: 'Not connected' },
          { id: 'oauth_needs_config' as const, label: 'OAuth needs config' },
        ] as const
      ).map((option) => ({
        ...option,
        count: countProvidersForStatus(searchedProviders, option.id, statusByService),
      })),
    [searchedProviders, statusByService],
  )

  const selectedProvider = props.selectedService
    ? (props.data.providers.find((provider) => provider.service === props.selectedService) ?? null)
    : null
  const selectedStatus = selectedProvider
    ? (statusByService.get(selectedProvider.service) ??
      resolveProviderConnectionStatus(selectedProvider, props.data.connections, props.data.oauthConfigs))
    : null

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-56 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-8 pl-9 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search providers…"
            aria-label="Search providers"
          />
        </label>
        <span className="text-xs text-muted-foreground">
          {visibleProviders.length} of {props.data.providers.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusCounts.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setStatusFilter(option.id)}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              statusFilter === option.id
                ? 'border-foreground/20 bg-foreground/5 font-medium'
                : 'border-border/40 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            {option.label}
            <span className="ml-1.5 tabular-nums opacity-70">{option.count}</span>
          </button>
        ))}
        {filtersActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setQuery('')
              setStatusFilter('all')
            }}
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-border/40 bg-background shadow-minimal">
          <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
            <div>
              <strong className="text-sm">Providers</strong>
              <div className="text-xs text-muted-foreground">
                {statusFilter === 'all' ? 'All statuses' : statusCounts.find((o) => o.id === statusFilter)?.label}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {visibleProviders.length === 0 ? (
              <EmptyState
                title={props.data.providers.length === 0 ? 'No providers loaded' : 'No providers match'}
                description={
                  props.data.providers.length === 0
                    ? 'The sidecar catalog is empty or failed to load. Run `bun run setup:open-connector`, then restart Craft Agents.'
                    : 'Try a different search or clear filters.'
                }
              />
            ) : (
              <>
                {renderedProviders.map((provider) => {
                  const status =
                    statusByService.get(provider.service) ??
                    resolveProviderConnectionStatus(provider, [], [])
                  const selected = props.selectedService === provider.service
                  return (
                    <button
                      key={provider.service}
                      type="button"
                      onClick={() => props.onSelectService(provider.service)}
                      aria-current={selected ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 border-b border-border/20 px-3 py-2.5 text-left transition-colors ${
                        selected ? 'bg-foreground/5' : 'hover:bg-muted/30'
                      }`}
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' } as CSSProperties}
                    >
                      <ProviderIcon provider={provider} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">{provider.displayName}</span>
                          <ProviderStatusBadges status={status} />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{provider.service}</div>
                      </div>
                    </button>
                  )
                })}
                {hasMore ? (
                  <div ref={loadMoreRef} className="flex justify-center p-3">
                    <Button variant="outline" size="sm" type="button" onClick={loadMore}>
                      Show more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-auto rounded-[8px] border border-border/40 bg-background p-4 shadow-minimal">
          {selectedProvider && selectedStatus ? (
            <ProviderDetail
              provider={selectedProvider}
              connection={selectedStatus.connection}
              connectionStatus={selectedStatus}
              oauthConfig={props.data.oauthConfigs.find(
                (config) => config.service === selectedProvider.service && config.configured,
              )}
              config={props.config}
              onSelectAction={props.onSelectAction}
              onRefresh={props.onRefresh}
            />
          ) : props.selectedService ? (
            <EmptyState
              title="Provider not found"
              description={`No provider named “${props.selectedService}” is in the catalog.`}
            />
          ) : (
            <EmptyState
              icon={<Cable className="h-5 w-5 text-muted-foreground" />}
              title="Select a provider"
              description="Choose a provider from the list to connect credentials and inspect actions."
            />
          )}
        </section>
      </div>
    </div>
  )
}

function ProviderStatusBadges(props: {
  status: ProviderConnectionStatus
  includeDisconnected?: boolean
}): ReactNode {
  const badges: ReactNode[] = []
  if (props.status.noSetupRequired) {
    badges.push(
      <Badge key="no-setup" tone="success">
        No setup
      </Badge>,
    )
  } else if (props.status.connected) {
    badges.push(
      <Badge key="connected" tone="success">
        Connected
      </Badge>,
    )
  } else if (props.includeDisconnected) {
    badges.push(<Badge key="disconnected">Not connected</Badge>)
  }
  if (props.status.oauthClientRequired) {
    badges.push(
      <Badge key="oauth" tone="warning">
        OAuth needs config
      </Badge>,
    )
  }
  return badges.length > 0 ? <span className="flex flex-wrap gap-1">{badges}</span> : null
}

function ProviderDetail(props: {
  provider: ProviderDefinition
  connection?: AppData['connections'][number]
  connectionStatus: ProviderConnectionStatus
  oauthConfig?: OAuthConfig
  config: OpenConnectorConfig | null
  onSelectAction: (actionId: string) => void
  onRefresh(): void
}): ReactNode {
  const [selectedAuthType, setSelectedAuthType] = useState(
    () => initialAuthType(props.provider, props.connection),
  )
  const [oauthClientExpanded, setOAuthClientExpanded] = useState(false)
  const selectedAuth =
    props.provider.auth.find((auth) => auth.type === selectedAuthType) ?? props.provider.auth[0]
  const oauthAuth = props.provider.auth.find((auth) => auth.type === 'oauth2')
  const hasMultipleAuthMethods = props.provider.auth.length > 1
  const authLabels = providerAuthTypeLabels(props.provider)
  const oauthConfigured = props.oauthConfig != null
  const summaryCards = [
    {
      key: 'actions',
      label: 'Actions',
      value: String(props.provider.actions.length),
      meta: `${props.provider.actions.filter((action) => action.execution.locallyExecutable).length} executable`,
    },
    {
      key: 'auth',
      label: 'Auth',
      value: authLabels[0] ?? 'None',
      meta:
        authLabels.length > 1
          ? `+${authLabels.length - 1} more`
          : props.connectionStatus.connected || props.connectionStatus.noSetupRequired
            ? 'Ready'
            : 'Needs setup',
    },
    {
      key: 'oauth',
      label: 'OAuth config',
      value: oauthAuth ? (oauthConfigured ? 'Configured' : 'Required') : 'N/A',
      meta: oauthAuth
        ? oauthConfigured
          ? 'Client ready'
          : 'Client missing'
        : 'Not an OAuth provider',
    },
  ]

  useEffect(() => {
    setSelectedAuthType(initialAuthType(props.provider, props.connection))
  }, [props.provider.service, props.connection?.authType])

  useEffect(() => {
    setOAuthClientExpanded(false)
  }, [props.provider.service, props.oauthConfig?.clientId])

  const connectionDescription = props.connectionStatus.noSetupRequired
    ? 'No credentials required for this provider.'
    : props.connectionStatus.connected
      ? `Connected via ${props.connection?.authType ?? 'credentials'}.`
      : props.connectionStatus.oauthClientRequired
        ? `Configure an OAuth client before connecting ${props.provider.displayName}.`
        : `Connect ${props.provider.displayName} to use its actions.`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ProviderIcon provider={props.provider} large />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{props.provider.displayName}</h2>
              <ProviderStatusBadges status={props.connectionStatus} includeDisconnected />
            </div>
            {props.provider.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{props.provider.description}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">{props.provider.service}</span>
              {authLabels.map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
          </div>
        </div>
        {props.provider.homepageUrl ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void window.electronAPI.openUrl(props.provider.homepageUrl!)}
          >
            Homepage
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className="rounded-md border border-border/30 bg-muted/20 px-3 py-2.5"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </div>
            <div className="mt-1 truncate text-sm font-semibold">{card.value}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{card.meta}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-md border border-border/30 p-3">
        <div>
          <h3 className="text-sm font-semibold">Connection</h3>
          <p className="text-sm text-muted-foreground">{connectionDescription}</p>
        </div>
        {hasMultipleAuthMethods ? (
          <div className="flex flex-wrap gap-1 rounded-md bg-muted p-[3px]">
            {props.provider.auth.map((auth) => (
              <button
                key={auth.type}
                type="button"
                onClick={() => setSelectedAuthType(auth.type)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  selectedAuth?.type === auth.type
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {authTypeLabel(auth.type)}
              </button>
            ))}
          </div>
        ) : null}
        {selectedAuth ? (
          <ConnectionForm
            key={`${props.provider.service}:${selectedAuth.type}`}
            provider={props.provider}
            auth={selectedAuth}
            connection={props.connection}
            oauthConfig={props.oauthConfig}
            config={props.config}
            onRefresh={props.onRefresh}
            onConfigureOAuthClient={() => setOAuthClientExpanded(true)}
          />
        ) : (
          <EmptyState title="No connection method" description="This provider has no auth methods." />
        )}
        {oauthAuth && selectedAuth?.type === 'oauth2' ? (
          <div className="space-y-2 border-t border-border/30 pt-3">
            <h3 className="text-sm font-semibold">OAuth client</h3>
            <OAuthClientSettings
              provider={props.provider}
              auth={oauthAuth}
              config={props.oauthConfig}
              clientConfig={props.config}
              expanded={oauthClientExpanded}
              onToggle={() => setOAuthClientExpanded((value) => !value)}
              onRefresh={props.onRefresh}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-md border border-border/30 p-3">
        <div>
          <h3 className="text-sm font-semibold">Scopes</h3>
          <p className="text-sm text-muted-foreground">Required by this provider’s actions.</p>
        </div>
        <TagList
          values={[...new Set(props.provider.actions.flatMap((action) => action.requiredScopes))]}
          empty="No scopes required"
        />
      </section>

      <section className="space-y-3 rounded-md border border-border/30 p-3">
        <div>
          <h3 className="text-sm font-semibold">Actions</h3>
          <p className="text-sm text-muted-foreground">
            {props.provider.actions.length} action{props.provider.actions.length === 1 ? '' : 's'}
          </p>
        </div>
        {props.provider.actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions in catalog.</p>
        ) : (
          <div className="divide-y divide-border/30 rounded-md border border-border/30">
            {props.provider.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30"
                onClick={() => props.onSelectAction(action.id)}
              >
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{action.name}</strong>
                  <small className="block truncate font-mono text-xs text-muted-foreground">{action.id}</small>
                </span>
                <Badge tone={action.execution.locallyExecutable ? 'success' : undefined}>
                  {action.execution.locallyExecutable ? 'Executable' : 'Catalog only'}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ConnectionForm(props: {
  provider: ProviderDefinition
  auth: AuthDefinition
  connection?: AppData['connections'][number]
  oauthConfig?: OAuthConfig
  config: OpenConnectorConfig | null
  onRefresh(): void
  onConfigureOAuthClient(): void
}): ReactNode {
  const [values, setValues] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const stopOAuthRefreshPolling = useRef<(() => void) | undefined>(undefined)
  const fields = credentialFieldsFor(props.auth)
  const showActions = props.auth.type !== 'no_auth'
  const connected = props.connection != null
  const needsOAuthClient = props.auth.type === 'oauth2' && !props.oauthConfig
  const canSubmit = props.auth.type !== 'oauth2' || props.oauthConfig != null
  const submitLabel =
    props.auth.type === 'oauth2'
      ? `${connected ? 'Reconnect' : 'Connect'} ${props.provider.displayName}`
      : 'Save connection'

  useEffect(
    () => () => {
      stopOAuthRefreshPolling.current?.()
    },
    [],
  )

  useEffect(() => {
    if (props.connection) {
      stopOAuthRefreshPolling.current?.()
      stopOAuthRefreshPolling.current = undefined
    }
  }, [props.connection])

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!props.config) {
      setStatus('Runtime is not ready')
      return
    }
    const client = createOpenConnectorClient(props.config)
    setStatus(props.auth.type === 'oauth2' ? 'Opening OAuth…' : 'Saving…')
    try {
      if (props.auth.type === 'no_auth') {
        await putConnection(client, props.provider.service, { authType: 'no_auth' }, props.config.adminToken)
      } else if (props.auth.type === 'api_key') {
        await putConnection(
          client,
          props.provider.service,
          { authType: 'api_key', values },
          props.config.adminToken,
        )
      } else if (props.auth.type === 'custom_credential') {
        await putConnection(
          client,
          props.provider.service,
          { authType: 'custom_credential', values },
          props.config.adminToken,
        )
      } else {
        if (!canSubmit) {
          setStatus('Configure OAuth client first')
          return
        }
        const result = await startOAuthAuthorization(client, props.provider.service, props.config.adminToken)
        if (result.authorizationUrl) {
          await window.electronAPI.openUrl(result.authorizationUrl)
          stopOAuthRefreshPolling.current?.()
          stopOAuthRefreshPolling.current = startOAuthRefreshPolling(props.onRefresh)
        }
        setStatus('OAuth window opened — complete authorization in the browser')
        return
      }
      setStatus('Connection updated')
      props.onRefresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Connection failed')
    }
  }

  async function disconnect(): Promise<void> {
    if (!props.config) return
    const client = createOpenConnectorClient(props.config)
    setStatus('Disconnecting…')
    try {
      await deleteConnection(client, props.provider.service, props.config.adminToken)
      setStatus('Disconnected')
      props.onRefresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Disconnect failed')
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void submit(event)}>
      {props.auth.type === 'no_auth' ? (
        <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
          <span>No credentials required.</span>
        </div>
      ) : null}
      {props.auth.type === 'oauth2' ? (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            needsOAuthClient
              ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
              : 'border-border/40 bg-muted/20'
          }`}
        >
          {needsOAuthClient ? <Settings className="mt-0.5 h-4 w-4 shrink-0" /> : <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {needsOAuthClient
              ? `Configure an OAuth client for ${props.provider.displayName} first.`
              : connected
                ? `${props.provider.displayName} is connected via OAuth.`
                : `Connect ${props.provider.displayName} with OAuth.`}
          </span>
        </div>
      ) : null}
      {fields.map((field) => (
        <CredentialInput
          key={field.key}
          field={field}
          value={values[field.key] ?? ''}
          onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
        />
      ))}
      {showActions ? (
        <div className="flex flex-wrap gap-2">
          {needsOAuthClient ? (
            <Button type="button" onClick={props.onConfigureOAuthClient}>
              <Settings className="h-4 w-4" />
              Configure OAuth client
            </Button>
          ) : (
            <Button type="submit" disabled={!canSubmit || !props.config}>
              {props.auth.type === 'oauth2' ? <ExternalLink className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {submitLabel}
            </Button>
          )}
          {props.connection ? (
            <Button variant="outline" type="button" onClick={() => void disconnect()}>
              <Trash2 className="h-4 w-4" />
              Disconnect
            </Button>
          ) : null}
        </div>
      ) : null}
      {status ? <FormStatus message={status} /> : null}
    </form>
  )
}

function OAuthClientSettings(props: {
  provider: ProviderDefinition
  auth: AuthDefinition
  config?: OAuthConfig
  clientConfig: OpenConnectorConfig | null
  expanded: boolean
  onToggle(): void
  onRefresh(): void
}): ReactNode {
  const [status, setStatus] = useState<string | null>(null)

  async function reset(): Promise<void> {
    if (!props.clientConfig) return
    const client = createOpenConnectorClient(props.clientConfig)
    setStatus('Resetting…')
    try {
      await deleteOAuthConfig(client, props.provider.service, props.clientConfig.adminToken)
      setStatus('OAuth client reset')
      props.onRefresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Reset failed')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/30 bg-muted/20 p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <strong className="text-sm">{props.config ? 'OAuth client configured' : 'OAuth client required'}</strong>
            <Badge tone={props.config ? 'success' : 'warning'}>
              {props.config ? 'Configured' : 'Required'}
            </Badge>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {props.config?.clientId ?? `Add a client ID/secret for ${props.provider.displayName}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" type="button" onClick={props.onToggle}>
            <Settings className="h-3.5 w-3.5" />
            {props.expanded ? 'Close' : props.config ? 'Edit' : 'Configure'}
          </Button>
          {props.config ? (
            <Button variant="outline" size="sm" type="button" onClick={() => void reset()}>
              <Trash2 className="h-3.5 w-3.5" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>
      {status ? <FormStatus message={status} /> : null}
      {props.auth.type === 'oauth2' && props.expanded ? (
        <OAuthConfigForm
          provider={props.provider}
          config={props.config}
          clientConfig={props.clientConfig}
          onRefresh={props.onRefresh}
        />
      ) : null}
    </div>
  )
}

function OAuthConfigForm(props: {
  provider: ProviderDefinition
  config?: OAuthConfig
  clientConfig: OpenConnectorConfig | null
  onRefresh(): void
}): ReactNode {
  const [clientId, setClientId] = useState(() => props.config?.clientId ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    setClientId(props.config?.clientId ?? '')
    setClientSecret('')
    setStatus(null)
  }, [props.provider.service, props.config?.clientId])

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!props.clientConfig) {
      setStatus('Runtime is not ready')
      return
    }
    const client = createOpenConnectorClient(props.clientConfig)
    setStatus('Saving…')
    try {
      await putOAuthConfig(
        client,
        props.provider.service,
        { clientId, clientSecret, extra: {} },
        props.clientConfig.adminToken,
      )
      setStatus('OAuth client saved')
      setClientSecret('')
      props.onRefresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed')
    }
  }

  return (
    <form className="space-y-3 rounded-md border border-border/30 p-3" onSubmit={(event) => void submit(event)}>
      <div className="space-y-1.5">
        <Label htmlFor="oc-client-id">Client ID</Label>
        <Input
          id="oc-client-id"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="oc-client-secret">Client secret</Label>
        <Input
          id="oc-client-secret"
          type="password"
          value={clientSecret}
          onChange={(event) => setClientSecret(event.target.value)}
          placeholder={props.config ? 'Leave blank to keep existing secret' : undefined}
          autoComplete="off"
        />
      </div>
      {props.config?.expectedRedirectUri ? (
        <p className="text-xs text-muted-foreground">
          Redirect URI: <span className="font-mono">{props.config.expectedRedirectUri}</span>
        </p>
      ) : null}
      <Button type="submit" disabled={!clientId.trim() || !props.clientConfig}>
        Save OAuth client
      </Button>
      {status ? <FormStatus message={status} /> : null}
    </form>
  )
}

function CredentialInput(props: {
  field: CredentialField
  value: string
  onChange: (value: string) => void
}): ReactNode {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`oc-field-${props.field.key}`}>
        {props.field.label}
        {props.field.required ? ' *' : ''}
      </Label>
      {props.field.inputType === 'textarea' || props.field.inputType === 'json' ? (
        <textarea
          id={`oc-field-${props.field.key}`}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.field.placeholder}
          required={props.field.required}
        />
      ) : (
        <Input
          id={`oc-field-${props.field.key}`}
          type={props.field.inputType === 'password' || props.field.secret ? 'password' : 'text'}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.field.placeholder}
          required={props.field.required}
          autoComplete="off"
        />
      )}
      {props.field.description ? (
        <p className="text-xs text-muted-foreground">{props.field.description}</p>
      ) : null}
    </div>
  )
}

function useProgressiveProviderLimit(
  total: number,
  resetKey: string,
): { hasMore: boolean; limit: number; loadMore(): void; ensureVisible(index: number): void } {
  const [limit, setLimit] = useState(providerPageSize)
  useEffect(() => {
    setLimit(providerPageSize)
  }, [resetKey])
  useEffect(() => {
    if (limit > total) setLimit(Math.max(providerPageSize, total))
  }, [limit, total])
  const loadMore = useCallback(() => {
    setLimit((current) => Math.min(current + providerPageSize, total))
  }, [total])
  const ensureVisible = useCallback((index: number) => {
    setLimit((current) => Math.max(current, Math.min(index + 1, total)))
  }, [total])
  return { hasMore: limit < total, limit: Math.min(limit, total), loadMore, ensureVisible }
}

function useIntersectionLoader(enabled: boolean, onLoad: () => void): (node: HTMLDivElement | null) => void {
  const onLoadRef = useRef(onLoad)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    onLoadRef.current = onLoad
  }, [onLoad])
  const setNode = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node
  }, [])
  useEffect(() => {
    const node = nodeRef.current
    if (!enabled || !node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadRef.current()
      },
      { rootMargin: '480px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])
  return setNode
}

function filterProvidersByStatus(
  providers: ProviderDefinition[],
  filter: ProviderStatusFilter,
  statusByService: Map<string, ProviderConnectionStatus>,
): ProviderDefinition[] {
  if (filter === 'all') return providers
  return providers.filter((provider) => {
    const status = statusByService.get(provider.service)
    if (!status) return false
    if (filter === 'connected') return status.connected || status.noSetupRequired
    if (filter === 'not_connected') return !status.connected && !status.noSetupRequired
    return status.oauthClientRequired
  })
}

function countProvidersForStatus(
  providers: ProviderDefinition[],
  filter: ProviderStatusFilter,
  statusByService: Map<string, ProviderConnectionStatus>,
): number {
  return filterProvidersByStatus(providers, filter, statusByService).length
}

function initialAuthType(
  provider: ProviderDefinition,
  connection: AppData['connections'][number] | undefined,
): AuthDefinition['type'] | undefined {
  const connectedAuth = provider.auth.find((auth) => auth.type === connection?.authType)
  return (connectedAuth ?? provider.auth.find((auth) => auth.type === 'api_key') ?? provider.auth[0])?.type
}

function providerAuthTypeLabels(provider: ProviderDefinition): string[] {
  const authTypes = provider.authTypes.length > 0 ? provider.authTypes : provider.auth.map((auth) => auth.type)
  return [...new Set(authTypes)].map(authTypeLabel)
}

function authTypeLabel(authType: string): string {
  if (authType === 'api_key') return 'API key'
  if (authType === 'oauth2') return 'OAuth'
  if (authType === 'custom_credential') return 'Custom'
  if (authType === 'no_auth') return 'No auth'
  return authType
}

export function startOAuthRefreshPolling(onRefresh: () => void): () => void {
  let remainingAttempts = oauthRefreshPollingMaxAttempts
  const interval = setInterval(() => {
    onRefresh()
    remainingAttempts -= 1
    if (remainingAttempts === 0) clearInterval(interval)
  }, oauthRefreshPollingIntervalMs)
  return () => clearInterval(interval)
}
