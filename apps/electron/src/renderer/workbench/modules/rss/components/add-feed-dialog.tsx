import { useState } from 'react'
import { useAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { rssAddFeedOpenAtom } from '../store'

type Props = {
  workspaceId: string
  onAdded: () => void
}

export function AddFeedDialog({ workspaceId, onAdded }: Props) {
  const [open, setOpen] = useAtom(rssAddFeedOpenAtom)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const close = () => {
    setOpen(false)
    setUrl('')
    setError(null)
  }

  const submit = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await window.electronAPI.rssAddFeed(workspaceId, { url: trimmed })
      close()
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add feed"
        className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
      >
        <h2 className="text-sm font-semibold mb-3">Add feed</h2>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/feed.xml"
          className="mb-2"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
            if (e.key === 'Escape') close()
          }}
        />
        {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void submit()} disabled={busy || !url.trim()}>
            {busy ? 'Adding…' : 'Subscribe'}
          </Button>
        </div>
      </div>
    </div>
  )
}
