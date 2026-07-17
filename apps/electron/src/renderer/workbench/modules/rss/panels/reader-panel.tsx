import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { ExternalLink, Sparkles, Star } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOpenAgentChat } from '../../../chat'
import { useAppShellContext } from '@/context/AppShellContext'
import type { CraftModulesRssArticle } from '@craft-agent/shared/craft-modules'
import {
  rssArticlesAtom,
  rssLoadingAtom,
  rssSelectedArticleIdAtom,
} from '../store'
import { formatAbsoluteTime } from '../utils'
import { useRssWorkspaceData, refreshRssData } from '../use-rss-data'
import { RssSkeletonRows } from '../components/rss-skeleton'

/**
 * Reader pane — live article body from craft-modules (star / open / ask AI).
 */
export function ReaderPanel() {
  const { workspaceId } = useRssWorkspaceData()
  const { activeWorkspaceId } = useAppShellContext()
  const loading = useAtomValue(rssLoadingAtom)
  const selectedId = useAtomValue(rssSelectedArticleIdAtom)
  const listArticles = useAtomValue(rssArticlesAtom)
  const openAgentChat = useOpenAgentChat()
  const [detail, setDetail] = useState<CraftModulesRssArticle | null>(null)
  const [busyStar, setBusyStar] = useState(false)

  const listHit = selectedId ? listArticles.find((a) => a.id === selectedId) : undefined

  useEffect(() => {
    let cancelled = false
    const ws = workspaceId || activeWorkspaceId
    if (!selectedId || !ws || !window.electronAPI?.rssGetArticle) {
      setDetail(listHit ?? null)
      return
    }
    void (async () => {
      try {
        const full = await window.electronAPI.rssGetArticle(ws, selectedId)
        if (!cancelled) setDetail(full)
      } catch {
        if (!cancelled) setDetail(listHit ?? null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, workspaceId, activeWorkspaceId, listHit])

  const article = detail ?? listHit ?? null

  const toggleStar = async () => {
    if (!article || !workspaceId) return
    setBusyStar(true)
    try {
      await window.electronAPI.rssToggleStar(workspaceId, article, !article.isStarred)
      await refreshRssData()
      const full = await window.electronAPI.rssGetArticle(workspaceId, article.id)
      setDetail(full)
    } catch {
      // ignore
    } finally {
      setBusyStar(false)
    }
  }

  const askAi = () => {
    if (!article) return
    void openAgentChat({
      placement: 'right',
      context: {
        type: 'rss-article',
        articleId: article.id,
        title: article.title,
        feedTitle: article.feedName,
        url: article.link,
      },
    })
  }

  const openOriginal = () => {
    if (!article?.link) return
    void window.electronAPI.openUrl(article.link)
  }

  const bodyHtml = article?.content || article?.summary || ''

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
                onClick={askAi}
                title="Ask AI about this article"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask AI
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                disabled={busyStar || !workspaceId}
                onClick={() => void toggleStar()}
                title={article.isStarred ? 'Unstar' : 'Star'}
              >
                <Star className={cn('h-3.5 w-3.5', article.isStarred && 'fill-current')} />
                {article.isStarred ? 'Starred' : 'Star'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Open original"
                onClick={openOriginal}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null
        }
      />
      <PanelBody padding={false} className="p-0">
        {loading && !article ? (
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
                {article.feedName ? <span>{article.feedName}</span> : null}
                {article.author ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{article.author}</span>
                  </>
                ) : null}
                {article.pubDate ? (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={article.pubDate}>{formatAbsoluteTime(article.pubDate)}</time>
                  </>
                ) : null}
              </div>
            </header>
            {bodyHtml ? (
              <div
                className={cn(
                  'rss-reader-body text-sm leading-relaxed text-foreground/90',
                  '[&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
                  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold',
                  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:my-3',
                  '[&_pre]:rounded-md [&_pre]:bg-muted/60 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:mb-3',
                  '[&_code]:text-xs [&_hr]:my-4 [&_hr]:border-border',
                  '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2',
                  '[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-3',
                )}
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No content for this article.</p>
            )}
          </article>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
