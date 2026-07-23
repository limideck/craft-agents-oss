import { useEffect, useRef } from 'react'
import { Copy, Send, Highlighter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SelectionDraft } from './types'

type SelectionPopoverProps = {
  draft: SelectionDraft
  note: string
  onNoteChange: (value: string) => void
  /** Optional AI preview line shown above the note (e.g. rewrite / translate hint). */
  previewLabel?: string
  previewText?: string
  onCopy: () => void
  onSendToAi: () => void
  onUnderline: () => void
  onTranslate: () => void
  onRewrite: () => void
  onClose: () => void
}

/**
 * Floating selection popup (图二): quote/AI preview, note, 复制 / 发给AI / 划线/点评.
 */
export function SelectionPopover({
  draft,
  note,
  onNoteChange,
  previewLabel = '选中文本',
  previewText,
  onCopy,
  onSendToAi,
  onUnderline,
  onTranslate,
  onRewrite,
  onClose,
}: SelectionPopoverProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [draft.quote])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const display = previewText?.trim() || draft.quote

  return (
    <div
      className={cn(
        'absolute z-30 w-[min(360px,calc(100%-16px))] rounded-[10px] border border-border bg-background p-2.5',
        'shadow-[var(--shadow-modal-small)]',
      )}
      style={{ top: draft.top, left: draft.left }}
      role="dialog"
      aria-label="划线点评"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="max-h-[72px] overflow-auto rounded-[7px] bg-foreground-5 px-2 py-1.5 text-[12.5px] leading-relaxed text-foreground/90">
        <span className="text-muted-foreground">{previewLabel}：</span>
        {display}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          className="h-6 rounded-full border border-border/80 bg-background px-2.5 text-[11px] text-muted-foreground hover:bg-foreground-5 hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onTranslate}
        >
          翻译
        </button>
        <button
          type="button"
          className="h-6 rounded-full border border-border/80 bg-background px-2.5 text-[11px] text-muted-foreground hover:bg-foreground-5 hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRewrite}
        >
          中文改写
        </button>
      </div>

      <textarea
        ref={inputRef}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="补充点评，可留空只划线…"
        rows={3}
        className={cn(
          'mt-2 w-full resize-y rounded-lg border border-border bg-background px-2.5 py-2 text-xs leading-relaxed outline-none',
          'placeholder:text-muted-foreground focus:border-accent',
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            onUnderline()
          }
        }}
      />

      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mr-auto h-7 gap-1 rounded-md px-2.5 text-[11px]"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCopy}
        >
          <Copy className="h-3 w-3" />
          复制
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 rounded-md px-2.5 text-[11px]"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSendToAi}
        >
          <Send className="h-3 w-3" />
          发给AI
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 gap-1 rounded-md px-2.5 text-[11px]"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onUnderline}
        >
          <Highlighter className="h-3 w-3" />
          划线/点评
        </Button>
      </div>
    </div>
  )
}
