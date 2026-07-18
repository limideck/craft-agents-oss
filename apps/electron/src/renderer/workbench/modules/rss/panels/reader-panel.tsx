import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { AlignLeft, ExternalLink, Mic, Sparkles, Star } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOpenAgentChat } from '../../../chat'
import { useAppShellContext } from '@/context/AppShellContext'
import type { GroseModulesRssArticle } from '@grose-agent/shared/grose-modules'
import {
  rssArticlesAtom,
  rssLoadingAtom,
  rssSelectedArticleIdAtom,
} from '../store'
import { formatAbsoluteTime } from '../utils'
import { useRssWorkspaceData, refreshRssData } from '../use-rss-data'
import { RssSkeletonRows } from '../components/rss-skeleton'
import { PodcastPlayer } from '../components/podcast-player'

type FullContent = null | 'loading' | { html: string } | { error: string }

/**
 * Reader pane — live article body from grose-modules (star / open / ask AI / 全文 / podcast).
 */
export function ReaderPanel() {
  const { workspaceId } = useRssWorkspaceData()
  const { activeWorkspaceId } = useAppShellContext()
  const loading = useAtomValue(rssLoadingAtom)
  const selectedId = useAtomValue(rssSelectedArticleIdAtom)
  const listArticles = useAtomValue(rssArticlesAtom)
  const openAgentChat = useOpenAgentChat()
  const [detail, setDetail] = useState<GroseModulesRssArticle | null>(null)
  const [busyStar, setBusyStar] = useState(false)
  const [fullContent, setFullContent] = useState<FullContent>(null)
  const [playing, setPlaying] = useState<GroseModulesRssArticle | null>(null)

  const listHit = selectedId ? listArticles.find((a) => a.id === selectedId) : undefined

  useEffect(() => {
    let cancelled = false
    const ws = workspaceId || activeWorkspaceId
    setFullContent(null)
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

  const fetchFull = async () => {
    if (!article?.link || !workspaceId) return
    setFullContent('loading')
    try {
      const res = await window.electronAPI.rssFetchArticleContent(workspaceId, article.link)
      setFullContent({ html: res.content })
    } catch (err) {
      setFullContent({ error: err instanceof Error ? err.message : String(err) })
    }
  }

  const fullHtml =
    fullContent && typeof fullContent === 'object' && 'html' in fullContent
      ? fullContent.html
      : null
  const fullError =
    fullContent && typeof fullContent === 'object' && 'error' in fullContent
      ? fullContent.error
      : null
  const bodyHtml = fullHtml || article?.content || article?.summary || ''

  return (
    <PanelRoot>
      <PanelHeaderBarSplit
        left={<span className="font-medium truncate">Reader</span>}
        right={
          article ? (
            <>
              {article.link && !fullHtml && fullContent !== 'loading' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  disabled={!workspaceId}
                  onClick={() => void fetchFull()}
                  title="Fetch full article text"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                  全文
                </Button>
              ) : null}
              {fullContent === 'loading' ? (
                <span className="text-xs text-muted-foreground px-1">Loading…</span>
              ) : null}
              {fullHtml ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setFullContent(null)}
                  title="Restore RSS content"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                  全文
                </Button>
              ) : null}
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
      <PanelBody padding={false} scroll={false} className="p-0 flex flex-col min-h-0">
        {loading && !article ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RssSkeletonRows rows={10} />
          </div>
        ) : !article ? (
          <div className="flex h-full min-h-[160px] flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Select an article to read.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
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
              {article.audioUrl ? (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Podcast
                    {article.audioDuration ? ` · ${article.audioDuration}` : ''}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 px-2 text-xs"
                    onClick={() => setPlaying(article)}
                  >
                    Play
                  </Button>
                </div>
              ) : null}
              {fullError ? (
                <p className="mb-3 text-xs text-destructive">Full text failed: {fullError}</p>
              ) : null}
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
          </div>
        )}
        {playing?.audioUrl ? (
          <PodcastPlayer
            episode={{
              id: playing.id,
              title: playing.title,
              feedName: playing.feedName,
              audioUrl: playing.audioUrl,
            }}
            onClose={() => setPlaying(null)}
          />
        ) : null}
      </PanelBody>
    </PanelRoot>
  )
}
