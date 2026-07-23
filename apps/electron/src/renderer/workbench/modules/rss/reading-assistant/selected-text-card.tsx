import { X } from 'lucide-react'
import type { ActiveSelectionContext } from './types'

type SelectedTextCardProps = {
  context: ActiveSelectionContext
  onDismiss: () => void
}

/**
 * Dismissible "选中文本" card (图一 middle) shown after 发给AI / chip-with-selection.
 */
export function SelectedTextCard({ context, onDismiss }: SelectedTextCardProps) {
  return (
    <div className="mb-3 rounded-xl border border-border bg-background px-3 py-2.5 shadow-[var(--shadow-modal-small)]">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">选中文本</span>
        <button
          type="button"
          className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-foreground-5 hover:text-foreground"
          aria-label="关闭选中文本"
          onClick={onDismiss}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mb-1.5 text-[10px] text-muted-foreground">{context.metaLabel}</p>
      <blockquote className="border-l-2 border-border pl-2.5 text-xs leading-relaxed text-foreground/85">
        {context.quote}
        {context.note ? (
          <span className="mt-1 block text-muted-foreground">点评：{context.note}</span>
        ) : null}
      </blockquote>
    </div>
  )
}
