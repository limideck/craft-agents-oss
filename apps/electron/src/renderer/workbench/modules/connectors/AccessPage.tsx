import type { AppData, RuntimeTokenCreation } from './model'
import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react'
import {
  createOpenConnectorClient,
  createRuntimeToken,
  revokeRuntimeToken,
  type OpenConnectorConfig,
} from './api'
import { formatDate } from './model'
import { Badge, EmptyState, FormStatus } from './shared-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AccessPageProps {
  data: AppData
  config: OpenConnectorConfig | null
  onRefresh(): void
}

export function AccessPage(props: AccessPageProps): ReactNode {
  const tokens = props.data.runtimeTokens
  const [name, setName] = useState('')
  const [created, setCreated] = useState<RuntimeTokenCreation | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!props.config) {
      setStatus('Runtime is not ready')
      return
    }
    setStatus('Creating…')
    setCreated(null)
    try {
      const client = createOpenConnectorClient(props.config)
      const result = await createRuntimeToken(client, name, props.config.adminToken)
      setCreated(result)
      setName('')
      setStatus('Created')
      props.onRefresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Create failed')
    }
  }

  async function revoke(id: string): Promise<void> {
    if (!props.config) return
    setStatus('Revoking…')
    try {
      const client = createOpenConnectorClient(props.config)
      await revokeRuntimeToken(client, id, props.config.adminToken)
      setStatus('Revoked')
      props.onRefresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Revoke failed')
    }
  }

  async function copyToken(token: string): Promise<void> {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Access & Docs</h2>
            <p className="text-sm text-muted-foreground">
              Manage runtime bearer tokens used by MCP and HTTP clients.
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => { setCreateOpen(true); setCreated(null); setStatus(null); setName('') }} disabled={!props.config}>
          <KeyRound className="h-4 w-4" />
          Create token
        </Button>
      </div>

      {props.config ? (
        <div className="rounded-[8px] border border-border/40 bg-background p-4 text-sm shadow-minimal">
          <div className="font-medium">Runtime endpoint</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{props.config.baseUrl}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            MCP: <span className="font-mono">{props.config.baseUrl}/mcp</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void window.electronAPI.openUrl(`${props.config!.baseUrl}/docs`)}
            >
              Open API docs
            </Button>
          </div>
        </div>
      ) : null}

      {!createOpen && status ? <FormStatus message={status} /> : null}

      <section className="overflow-hidden rounded-[8px] border border-border/40 bg-background shadow-minimal">
        {tokens.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-5 w-5 text-muted-foreground" />}
            title="No runtime tokens"
            description="Create a token to authenticate MCP or HTTP clients against the local runtime."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Last used</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-b border-border/20">
                  <td className="px-3 py-2 font-medium">{token.name}</td>
                  <td className="px-3 py-2">
                    <Badge tone="success">Active</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{formatDate(token.createdAt)}</td>
                  <td className="px-3 py-2 text-xs">
                    {token.lastUsedAt ? formatDate(token.lastUsedAt) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => void revoke(token.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {createOpen ? (
        <Dialog open onOpenChange={(open) => (!open ? setCreateOpen(false) : undefined)}>
          <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b border-border/30 px-4 py-3">
              <DialogTitle>{created ? 'New token' : 'Create token'}</DialogTitle>
              <DialogDescription>
                {created
                  ? 'Copy this token now — it will not be shown again.'
                  : 'Name the token so you can revoke it later.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 p-4">
              {created ? (
                <>
                  <div className="overflow-hidden rounded-md border border-border/40">
                    <div className="flex items-center justify-between border-b border-border/30 bg-muted/20 px-3 py-2">
                      <strong className="text-sm">Runtime token</strong>
                      <Button variant="outline" size="sm" onClick={() => void copyToken(created.token)}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="overflow-auto p-3 font-mono text-xs">{created.token}</pre>
                  </div>
                  <FormStatus message="This token is shown only once." />
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Close
                  </Button>
                </>
              ) : (
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                  <div className="space-y-1.5">
                    <Label htmlFor="oc-token-name">Name</Label>
                    <Input
                      id="oc-token-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. local-dev"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={!name.trim() || !props.config}>
                      <KeyRound className="h-4 w-4" />
                      Create token
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      Close
                    </Button>
                  </div>
                  {status ? <FormStatus message={status} /> : null}
                </form>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
