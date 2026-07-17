import type { ActionDefinition, AppData, JsonSchema } from './model'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Check, Code2, Copy, Play, Search, TerminalSquare } from 'lucide-react'
import { createOpenConnectorClient, executeAction, type OpenConnectorConfig } from './api'
import { buildActionExamples, filterActions, parameterSummaries, exampleInput } from './model'
import { Badge, EmptyState, FormStatus, TagList } from './shared-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const actionPageSize = 120

interface ActionsPageProps {
  data: AppData
  config: OpenConnectorConfig | null
  selectedActionId: string | null
  onSelectAction: (actionId: string | null) => void
  onSelectProvider: (service: string) => void
  onRefresh(): void
}

export function ActionsPage(props: ActionsPageProps): ReactNode {
  const [query, setQuery] = useState('')
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [visibleLimit, setVisibleLimit] = useState(actionPageSize)

  const allActions = useMemo(
    () => props.data.providers.flatMap((provider) => provider.actions),
    [props.data.providers],
  )
  const providerNames = useMemo(
    () => new Map(props.data.providers.map((p) => [p.service, p.displayName])),
    [props.data.providers],
  )
  const visibleActions = useMemo(
    () => filterActions(allActions, query, selectedService),
    [allActions, query, selectedService],
  )
  const renderedActions = visibleActions.slice(0, visibleLimit)
  const selectedAction =
    allActions.find((action) => action.id === props.selectedActionId) ??
    visibleActions[0] ??
    null

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-56 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-8 pl-9 text-sm"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setVisibleLimit(actionPageSize)
            }}
            placeholder="Search actions…"
          />
        </label>
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          value={selectedService ?? ''}
          onChange={(event) => {
            setSelectedService(event.target.value || null)
            setVisibleLimit(actionPageSize)
          }}
        >
          <option value="">All providers</option>
          {props.data.providers.map((provider) => (
            <option key={provider.service} value={provider.service}>
              {provider.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-border/40 bg-background shadow-minimal">
          <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
            <div>
              <strong className="text-sm">{visibleActions.length} actions</strong>
              <div className="text-xs text-muted-foreground">
                {selectedService
                  ? (providerNames.get(selectedService) ?? selectedService)
                  : 'All providers'}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {visibleActions.length === 0 ? (
              <EmptyState title="No actions" description="Try a different search or provider filter." />
            ) : (
              <>
                {renderedActions.map((action) => {
                  const selected = selectedAction?.id === action.id
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => props.onSelectAction(action.id)}
                      className={`flex w-full items-start gap-2 border-b border-border/20 px-3 py-2.5 text-left transition-colors ${
                        selected ? 'bg-foreground/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{action.name}</strong>
                        <small className="block truncate font-mono text-xs text-muted-foreground">
                          {action.id}
                        </small>
                      </span>
                    </button>
                  )
                })}
                {visibleLimit < visibleActions.length ? (
                  <div className="p-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setVisibleLimit((value) => value + actionPageSize)}
                    >
                      Show more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-auto rounded-[8px] border border-border/40 bg-background p-4 shadow-minimal">
          {selectedAction ? (
            <ActionDetail
              action={selectedAction}
              providerName={providerNames.get(selectedAction.service) ?? selectedAction.service}
              config={props.config}
              onSelectProvider={() => props.onSelectProvider(selectedAction.service)}
              onRefresh={props.onRefresh}
            />
          ) : (
            <EmptyState
              icon={<TerminalSquare className="h-5 w-5 text-muted-foreground" />}
              title="Select an action"
              description="Choose an action from the list to inspect schema and try a run."
            />
          )}
        </section>
      </div>
    </div>
  )
}

function ActionDetail(props: {
  action: ActionDefinition
  providerName: string
  config: OpenConnectorConfig | null
  onSelectProvider(): void
  onRefresh(): void
}): ReactNode {
  const [debugOpen, setDebugOpen] = useState(false)
  const examples = useMemo(
    () => buildActionExamples(props.action, props.config?.baseUrl),
    [props.action, props.config?.baseUrl],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Code2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{props.action.name}</h2>
            <p className="font-mono text-xs text-muted-foreground">{props.action.id}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={props.action.execution.locallyExecutable ? 'success' : undefined}>
            {props.action.execution.locallyExecutable ? 'Locally executable' : 'Catalog only'}
          </Badge>
          <Badge>{props.action.execution.noAuthRunnable ? 'No auth' : 'Needs credential'}</Badge>
          <Badge>{props.providerName}</Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{props.action.description}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!props.action.execution.locallyExecutable || !props.config}
          onClick={() => setDebugOpen(true)}
        >
          <Play className="h-4 w-4" />
          Try action
        </Button>
        <Button variant="outline" size="sm" onClick={props.onSelectProvider}>
          Provider
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Required scopes</h3>
        <TagList values={props.action.requiredScopes} empty="No scopes required" />
      </div>

      <ParameterList schema={props.action.inputSchema} />

      <ExampleTabs examples={examples} />

      {debugOpen ? (
        <RunActionModal
          action={props.action}
          config={props.config}
          onRefresh={props.onRefresh}
          onClose={() => setDebugOpen(false)}
        />
      ) : null}
    </div>
  )
}

function ParameterList(props: { schema: JsonSchema }): ReactNode {
  const parameters = parameterSummaries(props.schema)
  return (
    <details className="rounded-md border border-border/40 open:pb-2" open>
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold">
        Parameters
        <span className="ml-2 text-xs font-normal text-muted-foreground">{parameters.length} fields</span>
      </summary>
      {parameters.length === 0 ? (
        <p className="px-3 text-sm text-muted-foreground">No input parameters.</p>
      ) : (
        <div className="divide-y divide-border/30 border-t border-border/30">
          {parameters.map((parameter) => (
            <div key={parameter.name} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <strong className="text-sm">{parameter.name}</strong>
                {parameter.description ? (
                  <p className="text-xs text-muted-foreground">{parameter.description}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {parameter.required ? 'required' : 'optional'} · {parameter.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </details>
  )
}

function ExampleTabs(props: { examples: { curl: string; typescript: string } }): ReactNode {
  const [tab, setTab] = useState<'curl' | 'typescript'>('curl')
  const [copied, setCopied] = useState(false)
  const text = tab === 'curl' ? props.examples.curl : props.examples.typescript

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/40">
      <div className="flex items-center gap-1 border-b border-border/30 bg-muted/20 px-2 py-1.5">
        {(['curl', 'typescript'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded px-2 py-1 text-xs ${
              tab === id ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {id === 'curl' ? 'cURL' : 'TypeScript'}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={() => void copy()}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">{text}</pre>
    </div>
  )
}

function RunActionModal(props: {
  action: ActionDefinition
  config: OpenConnectorConfig | null
  onRefresh(): void
  onClose(): void
}): ReactNode {
  const [inputText, setInputText] = useState(() => exampleInput(props.action.inputSchema))
  const [status, setStatus] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!props.config) {
      setStatus('Runtime is not ready')
      return
    }
    setStatus('Running…')
    setResult(null)
    try {
      const parsed = JSON.parse(inputText) as unknown
      const client = createOpenConnectorClient(props.config)
      const response = await executeAction(
        client,
        props.action.id,
        parsed,
        props.config.runtimeToken,
      )
      setResult(JSON.stringify(response, null, 2))
      setStatus(response.success ? 'Success' : response.message ?? 'Failed')
      props.onRefresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Execution failed')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? props.onClose() : undefined)}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/30 px-4 py-3">
          <DialogTitle>Try {props.action.name}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{props.action.id}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3 p-4" onSubmit={(event) => void submit(event)}>
          <textarea
            className="min-h-[180px] w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!props.config}>
              <Play className="h-4 w-4" />
              Run
            </Button>
            <Button type="button" variant="outline" onClick={props.onClose}>
              Close
            </Button>
          </div>
          {status ? <FormStatus message={status} /> : null}
          {result ? (
            <pre className="max-h-64 overflow-auto rounded-md border border-border/40 bg-muted/20 p-3 font-mono text-xs">
              {result}
            </pre>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
