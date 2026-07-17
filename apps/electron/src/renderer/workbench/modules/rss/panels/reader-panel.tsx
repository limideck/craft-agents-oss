import { useAtom, useAtomValue } from 'jotai'
import { CheckCheck, ExternalLink, Circle } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getArticleById, getFeedById } from '../mock/data'
import {
  isArticleUnread,
  rssMockReadyAtom,
  rssReadOverridesAtom,
  rssSelectedArticleIdAtom,
} from '../store'
import { formatAbsoluteTime } from '../utils'
import { RssSkeletonRows, useRssMockReady } from '../components/rss-skeleton'

/**
 * Reader pane — title, meta, static sanitized HTML body from mock.
 */
export function ReaderPanel() {
  useRssMockReady()
  const ready = useAtomValue(rssMockReadyAtom)
  const selectedId = useAtomValue(rssSelectedArticleIdAtom)
  const [overrides, setOverrides] = useAtom(rssReadOverridesAtom)

  const article = selectedId ? getArticleById(selectedId) : undefined
  const feed = article ? getFeedById(article.feedId) : undefined
  const unread = article
    ? isArticleUnread(article.id, article.unread, overrides)
    : false

  const toggleRead = () => {
    if (!article) return
    setOverrides((prev) => ({ ...prev, [article.id]: unread }))
  }

  return (
    <PanelRoot>
      <PanelHeaderBarSplit
        left={<span className="font-medium truncate">Reader</span>}
        right={
          article ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={toggleRead}
                title={unread ? 'Mark as read' : 'Mark as unread'}
              >
                {unread ? (
                  <CheckCheck className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {unread ? 'Mark read' : 'Mark unread'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Open original (mock)"
                onClick={() => {
                  /* UI only — no navigation */
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null
        }
      />
      <PanelBody padding={false} className="p-0">
        {!ready ? (
          <RssSkeletonRows rows={10} />
        ) : !article ? (
          <div className="flex h-full min-h-[160px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Select an article to read.
          </div>
        ) : (
          <article className="mx-auto max-w-2xl px-5 py-4">
            <header className="mb-4 space-y-2 border-b border-border/80 pb-4">
              <h1 className="text-lg font-semibold leading-snug text-foreground text-balance">
                {article.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {feed ? <span>{feed.title}</span> : null}
                {article.author ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{article.author}</span>
                  </>
                ) : null}
                <span aria-hidden>·</span>
                <time dateTime={article.publishedAt}>{formatAbsoluteTime(article.publishedAt)}</time>
                <span
                  className={cn(
                    'ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px]',
                    unread ? 'bg-foreground-10 text-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {unread ? 'Unread' : 'Read'}
                </span>
              </div>
            </header>
            <div
              className={cn(
                'rss-reader-body text-sm leading-relaxed text-foreground/90',
                '[&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
                '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold',
                '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:my-3',
                '[&_pre]:rounded-md [&_pre]:bg-muted/60 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:mb-3',
                '[&_code]:text-xs [&_hr]:my-4 [&_hr]:border-border',
                '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2',
              )}
              // Static mock HTML only — never from network.
              dangerouslySetInnerHTML={{ __html: article.contentHtml }}
            />
          </article>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
