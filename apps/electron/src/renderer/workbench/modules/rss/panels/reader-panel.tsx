import { useEffect, useRef, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import {
  AlignLeft,
  BookOpen,
  ExternalLink,
  Mail,
  Mic,
  Pencil,
  Sparkles,
  Star,
  Tag,
  X,
} from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCloseAgentChat, useOpenAgentChat, CHAT_PANEL_ID } from '../../../chat'
import { dockviewApiAtom } from '../../../store/workbench-store'
import { useAppShellContext } from '@/context/AppShellContext'
import type { GroseModulesRssArticle } from '@grose-agent/shared/grose-modules'
import {
  effectiveStatus,
  excerptFromArticle,
  getArticleMeta,
  suggestAutoTags,
  TAG_COLORS,
} from '../local-meta'
import {
  patchArticleMeta,
  rssArticlesAtom,
  rssLoadingAtom,
  rssLocalStateAtom,
  rssPlayingEpisodeAtom,
  rssSelectedArticleIdAtom,
  type ReaderStatus,
} from '../store'
import { formatAbsoluteTime } from '../utils'
import { useRssWorkspaceData, refreshRssData } from '../use-rss-data'
import { RssSkeletonRows } from '../components/rss-skeleton'
import { EditArticleDialog } from '../components/edit-article-dialog'

type FullContent = null | 'loading' | { html: string } | { error: string }

type SelectionBar = {
  text: string
  top: number
  left: number
} | null

const STATUS_ACTIONS: { id: ReaderStatus; label: string; icon: typeof Mail }[] = [
  { id: 'unread', label: '未读', icon: Mail },
  { id: 'read', label: '已读', icon: BookOpen },
]

/**
 * 阅读面板 — 正文 + 未读/已读 + 标签 + 划词 AI + 摘要。
 */
export function ReaderPanel() {
  const { workspaceId } = useRssWorkspaceData()
  const { activeWorkspaceId } = useAppShellContext()
  const loading = useAtomValue(rssLoadingAtom)
  const selectedId = useAtomValue(rssSelectedArticleIdAtom)
  const listArticles = useAtomValue(rssArticlesAtom)
  const [localState, setLocalState] = useAtom(rssLocalStateAtom)
  const openAgentChat = useOpenAgentChat()
  const closeAgentChat = useCloseAgentChat()
  const dockApi = useAtomValue(dockviewApiAtom)
  const [chatOpen, setChatOpen] = useState(false)
  const [detail, setDetail] = useState<GroseModulesRssArticle | null>(null)
  const [busyStar, setBusyStar] = useState(false)
  const [fullContent, setFullContent] = useState<FullContent>(null)
  const [playingEpisode, setPlayingEpisode] = useAtom(rssPlayingEpisodeAtom)
  const [selectionBar, setSelectionBar] = useState<SelectionBar>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const listHit = selectedId ? listArticles.find((a) => a.id === selectedId) : undefined

  useEffect(() => {
    if (!dockApi) {
      setChatOpen(false)
      return
    }
    const sync = () => setChatOpen(!!dockApi.getPanel(CHAT_PANEL_ID))
    sync()
    const a = dockApi.onDidAddPanel(sync)
    const r = dockApi.onDidRemovePanel(sync)
    return () => {
      a.dispose()
      r.dispose()
    }
  }, [dockApi])

  useEffect(() => {
    let cancelled = false
    const ws = workspaceId || activeWorkspaceId
    setFullContent(null)
    setSelectionBar(null)
    setShowTagInput(false)
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
  const meta = article ? getArticleMeta(localState.metaById, article.id) : {}
  const status = article ? effectiveStatus(article, meta) : 'unread'
  const bodyHtml =
    meta.bodyOverride ||
    (fullContent && typeof fullContent === 'object' && 'html' in fullContent
      ? fullContent.html
      : null) ||
    article?.content ||
    article?.summary ||
    ''

  // Mark-as-read + lastViewedAt happen on explicit user open (list click / 标为已读),
  // not here — otherwise 未读 filter refresh auto-selects the next item and cascades.

  // Auto-tag on first open
  useEffect(() => {
    if (!article) return
    const current = getArticleMeta(localState.metaById, article.id)
    if (current.autoTagged) return
    const suggested = suggestAutoTags(article, localState.tags)
    if (suggested.length === 0) {
      setLocalState((prev) => patchArticleMeta(prev, article.id, { autoTagged: true }))
      return
    }
    const merged = Array.from(new Set([...(current.tags ?? []), ...suggested]))
    setLocalState((prev) => {
      let next = patchArticleMeta(prev, article.id, { tags: merged, autoTagged: true })
      const missing = suggested.filter((t) => !next.tags.includes(t))
      if (missing.length) next = { ...next, tags: [...next.tags, ...missing] }
      return next
    })
  }, [article?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const patchMeta = (patch: Parameters<typeof patchArticleMeta>[2]) => {
    if (!article) return
    setLocalState((prev) => patchArticleMeta(prev, article.id, patch))
  }

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

  const askAi = (seedPrompt?: string) => {
    if (!article) return
    if (chatOpen && !seedPrompt) {
      closeAgentChat()
      return
    }
    void openAgentChat({
      placement: 'right',
      seedPrompt,
      title: 'AI Chat',
      context: {
        type: 'rss-article',
        articleId: article.id,
        title: article.title,
        feedTitle: article.feedName,
        url: article.link,
      },
    })
  }

  const askSelection = (action: string, text: string) => {
    if (!article) return
    const prompts: Record<string, string> = {
      translate: `请把下面这段翻译成中文：\n\n${text}`,
      polish: `请润色下面这段文字，保持原意：\n\n${text}`,
      explain: `请解释下面这段内容：\n\n${text}`,
      ask: `关于「${article.title}」中选中的内容：\n\n${text}`,
      continue: `请基于下面这段续写：\n\n${text}`,
      summarize: `请用中文总结这篇文章「${article.title}」的要点。\n\n摘录：\n${excerptFromArticle(article, 400)}`,
    }
    setSelectionBar(null)
    void openAgentChat({
      placement: 'right',
      seedPrompt: prompts[action] ?? prompts.ask,
      title: 'AI Chat',
      context: {
        type: 'selection',
        text,
        source: article.title,
      },
    })
  }

  const generateSummary = () => {
    if (!article) return
    const summary =
      meta.summaryCache ||
      excerptFromArticle(article, 220) ||
      '暂无摘要。可用 AI Chat 生成更完整的总结。'
    patchMeta({ summaryCache: summary })
    askSelection('summarize', excerptFromArticle(article, 500) || article.title)
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

  const onMouseUp = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !scrollRef.current) {
      setSelectionBar(null)
      return
    }
    const text = sel.toString().trim()
    if (text.length < 2) {
      setSelectionBar(null)
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const pane = scrollRef.current.getBoundingClientRect()
    setSelectionBar({
      text,
      top: rect.top - pane.top - 40 + scrollRef.current.scrollTop,
      left: Math.min(Math.max(rect.left - pane.left + rect.width / 2 - 150, 8), pane.width - 320),
    })
  }

  const addTag = () => {
    const tag = tagDraft.trim()
    if (!tag || !article) return
    const tags = Array.from(new Set([...(meta.tags ?? []), tag]))
    setLocalState((prev) => {
      const next = patchArticleMeta(prev, article.id, { tags })
      return {
        ...next,
        tags: next.tags.includes(tag) ? next.tags : [...next.tags, tag],
      }
    })
    setTagDraft('')
    setShowTagInput(false)
  }

  const fullHtml =
    fullContent && typeof fullContent === 'object' && 'html' in fullContent
      ? fullContent.html
      : null
  const fullError =
    fullContent && typeof fullContent === 'object' && 'error' in fullContent
      ? fullContent.error
      : null

  return (
    <PanelRoot>
      <PanelHeaderBarSplit
        left={<span className="font-medium truncate">阅读</span>}
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
                  title="抓取全文"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                  全文
                </Button>
              ) : null}
              {fullContent === 'loading' ? (
                <span className="text-xs text-muted-foreground px-1">加载中…</span>
              ) : null}
              {fullHtml ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setFullContent(null)}
                  title="恢复 RSS 正文"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                  RSS
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="编辑"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="标签"
                onClick={() => setShowTagInput((v) => !v)}
              >
                <Tag className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={chatOpen ? 'default' : 'outline'}
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => askAi()}
                title={chatOpen ? '关闭 AI Chat' : '打开 AI Chat'}
              >
                {chatOpen ? <X className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {chatOpen ? '关闭' : 'AI Chat'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                disabled={busyStar || !workspaceId}
                onClick={() => void toggleStar()}
                title={article.isStarred ? '取消收藏' : '收藏'}
              >
                <Star className={cn('h-3.5 w-3.5', article.isStarred && 'fill-current')} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="打开原文"
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
            选择一篇文章开始阅读。
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto relative"
            onMouseUp={onMouseUp}
          >
            <article className="mx-auto max-w-2xl px-5 py-4">
              <div className="mb-3 flex flex-wrap gap-1">
                {STATUS_ACTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1 h-6 px-2 text-[11px] border border-border/80',
                      status === id
                        ? 'bg-foreground-10 text-foreground'
                        : 'text-muted-foreground hover:bg-foreground-5',
                    )}
                    onClick={() =>
                      patchMeta({
                        status: id,
                        ...(id === 'read' ? { lastViewedAt: meta.lastViewedAt ?? Date.now() } : {}),
                      })
                    }
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>

              <header className="mb-3 space-y-2">
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
                <div className="flex flex-wrap gap-1.5">
                  {(meta.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 h-6 px-2 text-[11px] border border-border/80 bg-foreground-5"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: TAG_COLORS[tag] ?? 'currentColor' }}
                      />
                      {tag}
                    </span>
                  ))}
                  {showTagInput ? (
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        addTag()
                      }}
                    >
                      <input
                        autoFocus
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        placeholder="Tag…"
                        className="h-6 w-24 border border-border bg-background px-2 text-[11px] outline-none focus:border-accent"
                        list="rss-tag-suggestions"
                      />
                      <datalist id="rss-tag-suggestions">
                        {localState.tags.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                      <Button type="submit" size="sm" className="h-6 rounded-none px-2 text-[11px]">
                        添加
                      </Button>
                    </form>
                  ) : null}
                </div>
                <h1 className="text-lg font-semibold leading-snug text-foreground text-balance">
                  {article.title}
                </h1>
              </header>

              {meta.summaryCache ? (
                <div className="mb-4 border border-[color-mix(in_oklab,var(--success)_28%,var(--border))] bg-[color-mix(in_oklab,var(--success)_12%,var(--background))] px-3 py-2.5">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[color-mix(in_oklab,var(--success)_55%,var(--foreground))]">
                    <Sparkles className="h-3 w-3" />
                    AI 摘要
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      onClick={() => patchMeta({ summaryCache: undefined })}
                    >
                      关闭
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/80">{meta.summaryCache}</p>
                </div>
              ) : (
                <button
                  type="button"
                  className="mb-4 flex w-full items-center gap-2 border border-dashed border-border/80 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-foreground-5 hover:text-foreground"
                  onClick={generateSummary}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  生成 AI 摘要…
                </button>
              )}

              {article.audioUrl ? (
                <div className="mb-4 flex items-center gap-2 border border-border bg-muted/30 px-3 py-2">
                  <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    播客
                    {article.audioDuration ? ` · ${article.audioDuration}` : ''}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 px-2 text-xs"
                    onClick={() =>
                      setPlayingEpisode({
                        id: article.id,
                        title: article.title,
                        feedName: article.feedName,
                        audioUrl: article.audioUrl,
                        position: playingEpisode?.id === article.id ? playingEpisode.position : 0,
                      })
                    }
                  >
                    播放
                  </Button>
                </div>
              ) : null}
              {fullError ? (
                <p className="mb-3 text-xs text-destructive">全文抓取失败：{fullError}</p>
              ) : null}
              {bodyHtml ? (
                <div
                  className={cn(
                    'rss-reader-body text-sm leading-relaxed text-foreground/90',
                    '[&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
                    '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold',
                    '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:my-3',
                    '[&_pre]:bg-muted/60 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:mb-3',
                    '[&_code]:text-xs [&_hr]:my-4 [&_hr]:border-border',
                    '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2',
                    '[&_img]:max-w-full [&_img]:h-auto [&_img]:my-3',
                  )}
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">此文章暂无正文。</p>
              )}
            </article>

            {selectionBar ? (
              <div
                className="absolute z-20 flex gap-px bg-foreground text-background p-0.5 shadow-[var(--shadow-modal-small)]"
                style={{ top: selectionBar.top, left: selectionBar.left }}
                role="toolbar"
                aria-label="Selection actions"
              >
                {(
                  [
                    ['translate', '翻译'],
                    ['polish', '润色'],
                    ['explain', '解释'],
                    ['ask', '问 AI'],
                    ['continue', '续写'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="px-2.5 py-1.5 text-[11px] hover:bg-background/10"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => askSelection(id, selectionBar.text)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </PanelBody>

      <EditArticleDialog
        open={editOpen}
        article={article}
        bodyHtml={bodyHtml}
        onClose={() => setEditOpen(false)}
        onSave={(title, body) => {
          if (!article) return
          patchMeta({ bodyOverride: body.split('\n').map((l) => `<p>${l || '&nbsp;'}</p>`).join('') })
          void title
          setEditOpen(false)
        }}
      />
    </PanelRoot>
  )
}
