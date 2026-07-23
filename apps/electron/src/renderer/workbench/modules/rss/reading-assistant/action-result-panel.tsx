import { Copy, Loader2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/utils'
import type { RssActionResultState } from './run-module-action'

type ActionResultPanelProps = {
  state: Exclude<RssActionResultState, { status: 'idle' }>
  onClose: () => void
  onCopy: () => void
  onEscalate: () => void
  onRetry?: () => void
}

/**
 * Inline Reader panel for Module Action results: loading → markdown → copy / escalate.
 */
export function ActionResultPanel({
  state,
  onClose,
  onCopy,
  onEscalate,
  onRetry,
}: ActionResultPanelProps) {
  const isLoading = state.status === 'loading'
  const isError = state.status === 'error'
  const isOk = state.status === 'ok'

  return (
    <div
      className={cn(
        'mb-4 rounded-xl border border-border bg-background px-3 py-2.5',
        'shadow-[var(--shadow-modal-small)]',
      )}
      role="region"
      aria-label={`${state.title} 结果`}
      aria-busy={isLoading}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">{state.title}</span>
        {isLoading ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            处理中…
          </span>
        ) : null}
        <button
          type="button"
          className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-foreground-5 hover:text-foreground"
          aria-label="关闭结果"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-xs text-muted-foreground">正在运行…</p>
      ) : null}

      {isError ? (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-destructive">{state.error}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-md px-2.5 text-[11px]"
              onClick={onRetry}
            >
              重试
            </Button>
          ) : null}
        </div>
      ) : null}

      {isOk ? (
        <>
          <div
            className={cn(
              'max-h-[280px] overflow-y-auto rounded-lg bg-foreground-5 px-2.5 py-2',
              'text-xs leading-relaxed text-foreground/90',
              '[&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4',
              '[&_h1]:mb-2 [&_h1]:text-sm [&_h1]:font-semibold',
              '[&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold',
              '[&_h3]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold',
              '[&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted/60 [&_pre]:p-2 [&_pre]:text-[11px]',
              '[&_code]:text-[11px]',
            )}
          >
            <Markdown mode="minimal">{state.resultMarkdown}</Markdown>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-md px-2.5 text-[11px]"
              onClick={onCopy}
            >
              <Copy className="h-3 w-3" />
              复制
            </Button>
            <Button
              type="button"
              size="sm"
              className="ml-auto h-7 gap-1 rounded-md px-2.5 text-[11px]"
              onClick={onEscalate}
            >
              <Send className="h-3 w-3" />
              发给 AI / 继续讨论
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
