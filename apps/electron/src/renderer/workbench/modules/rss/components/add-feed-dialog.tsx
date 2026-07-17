import { useEffect, useRef, useState } from 'react'
import { useAtom } from 'jotai'
import { AlertCircle, CheckCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { rssAddFeedOpenAtom } from '../store'

type Props = {
  workspaceId: string
  onAdded: () => void
}

type Tab = 'url' | 'opml'

type OpmlPhase = 'idle' | 'importing' | 'done' | 'error'

type ImportResult = { imported: number; skipped: number }

export function AddFeedDialog({ workspaceId, onAdded }: Props) {
  const [open, setOpen] = useAtom(rssAddFeedOpenAtom)
  const [tab, setTab] = useState<Tab>('url')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setTab('url')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const close = () => {
    setOpen(false)
    setTab('url')
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add feed"
        className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex rounded-md bg-muted/60 p-0.5">
            {(
              [
                ['url', 'URL'],
                ['opml', 'OPML'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  tab === key
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={close}>
            Close
          </Button>
        </div>
        {tab === 'url' ? (
          <UrlTab
            workspaceId={workspaceId}
            onAdded={() => {
              close()
              onAdded()
            }}
            onCancel={close}
          />
        ) : (
          <OpmlTab
            workspaceId={workspaceId}
            onImported={() => {
              onAdded()
            }}
            onClose={close}
          />
        )}
      </div>
    </div>
  )
}

function UrlTab({
  workspaceId,
  onAdded,
  onCancel,
}: {
  workspaceId: string
  onAdded: () => void
  onCancel: () => void
}) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await window.electronAPI.rssAddFeed(workspaceId, { url: trimmed })
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/feed.xml"
        className="mb-2"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
        }}
      />
      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} disabled={busy || !url.trim()}>
          {busy ? 'Adding…' : 'Subscribe'}
        </Button>
      </div>
    </div>
  )
}

function OpmlTab({
  workspaceId,
  onImported,
  onClose,
}: {
  workspaceId: string
  onImported: () => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<OpmlPhase>('idle')
  const [paste, setPaste] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const runImport = async (opml: string) => {
    const trimmed = opml.trim()
    if (!trimmed) return
    setPhase('importing')
    setErrMsg('')
    try {
      const res = await window.electronAPI.rssImportOpml(workspaceId, trimmed)
      setResult({ imported: res.imported, skipped: res.skipped })
      setPhase('done')
      onImported()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }

  const processFile = async (file: File) => {
    const text = await file.text()
    await runImport(text)
  }

  if (phase === 'done') {
    return (
      <div className="space-y-3 p-4 text-center">
        <CheckCircle className="mx-auto h-8 w-8 text-foreground/70" />
        <div>
          <p className="text-sm font-medium">Import complete</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Imported <strong>{result?.imported ?? 0}</strong>
            {result && result.skipped > 0 ? (
              <>
                {' '}
                · skipped {result.skipped} duplicate{result.skipped === 1 ? '' : 's'}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPhase('idle')
              setResult(null)
              setPaste('')
            }}
          >
            Import again
          </Button>
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="space-y-3 p-4 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Import failed</p>
        <p className="text-xs text-muted-foreground">{errMsg}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setPhase('idle')
            setErrMsg('')
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <div
        className={cn(
          'cursor-pointer rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragOver ? 'border-foreground/40 bg-muted/40' : 'border-border',
          phase === 'importing' && 'pointer-events-none opacity-70',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) void processFile(file)
        }}
        onClick={() => phase === 'idle' && inputRef.current?.click()}
      >
        <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">
          {phase === 'importing' ? 'Importing…' : 'Drop OPML file here'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">.opml or .xml</p>
        {phase === 'idle' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
          >
            Choose file
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".opml,.xml,application/xml,text/xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void processFile(f)
          e.target.value = ''
        }}
      />
      <div>
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
          Or paste OPML
        </label>
        <Textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="<?xml version=&quot;1.0&quot;?>…"
          className="min-h-[88px] font-mono text-xs"
          disabled={phase === 'importing'}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={phase === 'importing'}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={phase === 'importing' || !paste.trim()}
          onClick={() => void runImport(paste)}
        >
          {phase === 'importing' ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </div>
  )
}
