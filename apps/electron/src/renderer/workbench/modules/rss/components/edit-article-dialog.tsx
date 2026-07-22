import { useEffect, useState } from 'react'
import type { GroseModulesRssArticle } from '@grose-agent/shared/grose-modules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { stripHtml } from '../local-meta'

type Props = {
  open: boolean
  article: GroseModulesRssArticle | null
  bodyHtml: string
  onClose: () => void
  onSave: (title: string, bodyPlain: string) => void
}

/** Lightweight Markdown/plain editor for local body override. */
export function EditArticleDialog({ open, article, bodyHtml, onClose, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (!open || !article) return
    setTitle(article.title)
    setBody(stripHtml(bodyHtml || article.content || article.summary || ''))
  }, [open, article, bodyHtml])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !article) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit article"
        className="w-full max-w-xl overflow-hidden border border-border bg-card shadow-[var(--shadow-modal-small)]"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-medium">编辑 Markdown</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="space-y-2 p-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="text-sm leading-relaxed resize-y"
            placeholder="纯文本 / Markdown…"
          />
          <p className="text-[11px] text-muted-foreground">
            保存为本地正文覆盖（workspace localStorage）。服务端标题暂不修改。
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onClose}>
            取消
          </Button>
          <Button type="button" size="sm" className="h-7" onClick={() => onSave(title, body)}>
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}
