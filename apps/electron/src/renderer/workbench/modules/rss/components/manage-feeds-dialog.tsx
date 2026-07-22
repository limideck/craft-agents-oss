import { useEffect, useRef, useState } from 'react'
import { Check, Copy, CopyCheck, Download, Pencil, Trash2, X } from 'lucide-react'
import { useAtom, useAtomValue } from 'jotai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { GroseModulesRssFeed } from '@grose-agent/shared/grose-modules'
import { rssFeedsAtom, rssManageFeedsOpenAtom } from '../store'
import { refreshRssData } from '../use-rss-data'
import { FeedFavicon } from './feed-favicon'

type Props = {
  workspaceId: string
}

function downloadOpml(opml: string) {
  const blob = new Blob([opml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'feeds.opml'
  a.click()
  URL.revokeObjectURL(url)
}

export function ManageFeedsDialog({ workspaceId }: Props) {
  const [open, setOpen] = useAtom(rssManageFeedsOpenAtom)
  const feeds = useAtomValue(rssFeedsAtom)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const exportFeeds = async () => {
    setExportBusy(true)
    setExportError(null)
    try {
      const opml = await window.electronAPI.rssExportOpml(workspaceId)
      downloadOpml(opml)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage feeds"
        className="flex w-full max-w-lg max-h-[80vh] flex-col rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="flex-1 text-sm font-semibold">Manage feeds</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{feeds.length}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={exportBusy || feeds.length === 0}
            onClick={() => void exportFeeds()}
            title="Export OPML"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {exportError ? (
          <p className="px-4 pt-2 text-xs text-destructive">{exportError}</p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {feeds.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No subscriptions yet.</p>
          ) : (
            feeds.map((feed) => (
              <ManageFeedRow key={feed.id} workspaceId={workspaceId} feed={feed} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ManageFeedRow({
  workspaceId,
  feed,
}: {
  workspaceId: string
  feed: GroseModulesRssFeed
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(feed.name)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(feed.name)
  }, [feed.name])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === feed.name) {
      setEditing(false)
      setName(feed.name)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.electronAPI.rssRenameFeed(workspaceId, feed.id, trimmed)
      setEditing(false)
      await refreshRssData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Unsubscribe from “${feed.name}”?`)) return
    setBusy(true)
    setError(null)
    try {
      await window.electronAPI.rssDeleteFeed(workspaceId, feed.id)
      await refreshRssData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(feed.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-muted/40 px-4 py-1.5">
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 flex-1 text-sm"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') {
              setName(feed.name)
              setEditing(false)
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={busy || !name.trim()}
          onClick={() => void save()}
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={busy}
          onClick={() => {
            setName(feed.name)
            setEditing(false)
          }}
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2 px-4 py-1.5 hover:bg-muted/40">
      <FeedFavicon feedUrl={feed.url} size={16} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{feed.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{feed.url}</div>
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>
      <div
        className={cn(
          'flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={busy}
          onClick={() => void copyUrl()}
          title={copied ? 'Copied' : 'Copy URL'}
        >
          {copied ? <CopyCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={busy}
          onClick={() => setEditing(true)}
          title="Rename"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => void remove()}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
