import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
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
import type { GroseModulesRssArticle } from '@grose-agent/shared/grose-modules/types'
import {
  effectiveStatus,
  getArticleMeta,
  suggestAutoTags,
  TAG_COLORS,
} from '../local-meta'
import {
  applyTextAnnotations,
  buildAnnotationFromDraft,
  buildEscalateFromResultSeed,
  buildEscalateSelectionSeed,
  buildSelectionDraft,
  formatSelectionMetaLabel,
  ActionResultPanel,
  ReadingChips,
  SelectedTextCard,
  SelectionPopover,
  beginActionRun,
  runReadingModuleAction,
  type ActiveSelectionContext,
  type ReadingTask,
  type SelectionDraft,
} from '../reading-assistant'
import {
  patchArticleMeta,
  rssActionResultAtom,
  rssArticlesAtom,
  rssFeedsAtom,
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

const STATUS_ACTIONS: { id: ReaderStatus; label: string; icon: typeof Mail }[] = [
  { id: 'unread', label: '未读', icon: Mail },
  { id: 'read', label: '已读', icon: BookOpen },
]

/**
 * 阅读面板 — 正文 + 未读/已读 + 标签 + 划线点评 + 伴读 chips + AI。
 */
export function ReaderPanel() {
  const { workspaceId } = useRssWorkspaceData()
  const { activeWorkspaceId } = useAppShellContext()
  const loading = useAtomValue(rssLoadingAtom)
  const selectedId = useAtomValue(rssSelectedArticleIdAtom)
  const listArticles = useAtomValue(rssArticlesAtom)
  const feeds = useAtomValue(rssFeedsAtom)
  const [localState, setLocalState] = useAtom(rssLocalStateAtom)
  const [actionResult, setActionResult] = useAtom(rssActionResultAtom)
  const openAgentChat = useOpenAgentChat()
  const closeAgentChat = useCloseAgentChat()
  const dockApi = useAtomValue(dockviewApiAtom)
  const [chatOpen, setChatOpen] = useState(false)
  const [detail, setDetail] = useState<GroseModulesRssArticle | null>(null)
  const [busyStar, setBusyStar] = useState(false)
  const [fullContent, setFullContent] = useState<FullContent>(null)
  const [playingEpisode, setPlayingEpisode] = useAtom(rssPlayingEpisodeAtom)
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null)
  const [selectionNote, setSelectionNote] = useState('')
  const [activeSelection, setActiveSelection] = useState<ActiveSelectionContext | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

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
    setSelectionDraft(null)
    setSelectionNote('')
    setActiveSelection(null)
    setShowTagInput(false)
    setActionResult({ status: 'idle' })
    beginActionRun()
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
  const feedUrl = article
    ? feeds.find((f) => f.id === article.feedId)?.url
    : undefined
  const meta = article ? getArticleMeta(localState.metaById, article.id) : {}
  const status = article ? effectiveStatus(article, meta) : 'unread'
  const annotations = meta.annotations
  const annotationList = annotations ?? []
  /** Body HTML for display (override / fetched full / content, else summary). */
  const bodyOnlyHtml =
    meta.bodyOverride ||
    (fullContent && typeof fullContent === 'object' && 'html' in fullContent
      ? fullContent.html
      : null) ||
    article?.content ||
    ''
  const bodyHtml = bodyOnlyHtml || article?.summary || ''

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

  // Re-apply underline marks after body HTML / annotations change.
  useEffect(() => {
    const root = bodyRef.current
    if (!root) return
    applyTextAnnotations(root, annotationList)
  }, [bodyHtml, annotations, article?.id]) // annotationList derived; use annotations ref equality

  const patchMeta = (patch: Parameters<typeof patchArticleMeta>[2]) => {
    if (!article) return
    setLocalState((prev) => patchArticleMeta(prev, article.id, patch))
  }

  const closePopover = useCallback(() => {
    setSelectionDraft(null)
    setSelectionNote('')
    window.getSelection()?.removeAllRanges()
  }, [])

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

  const openWithSelection = (
    seedPrompt: string,
    quote: string,
    actionLabel: string,
    note?: string,
  ) => {
    if (!article) return
    setActiveSelection({
      quote,
      metaLabel: formatSelectionMetaLabel(actionLabel),
      note,
    })
    closePopover()
    void openAgentChat({
      placement: 'right',
      seedPrompt,
      title: 'AI Chat',
      context: {
        type: 'selection',
        text: quote,
        source: article.title,
      },
    })
  }

  const startModuleAction = useCallback(
    (opts: {
      actionId: string
      selection?: string
      selectionNote?: string
      selectionMetaLabel?: string
    }) => {
      if (!article) return
      const ws = workspaceId || activeWorkspaceId
      if (!ws) return

      if (opts.selection) {
        setActiveSelection({
          quote: opts.selection,
          metaLabel: formatSelectionMetaLabel(opts.selectionMetaLabel ?? '选中文本'),
          note: opts.selectionNote,
        })
        closePopover()
      }

      void runReadingModuleAction({
        workspaceId: ws,
        actionId: opts.actionId,
        articleId: article.id,
        url: article.link || undefined,
        feedUrl: feedUrl || undefined,
        title: article.title,
        selection: opts.selection,
        selectionNote: opts.selectionNote,
        onState: setActionResult,
      })
    },
    [article, feedUrl, workspaceId, activeWorkspaceId, closePopover, setActionResult],
  )

  const runReadingTask = (task: ReadingTask) => {
    if (!article) return
    const quote = selectionDraft?.quote || activeSelection?.quote
    const note = selectionDraft ? selectionNote : activeSelection?.note
    startModuleAction({
      actionId: task.actionId,
      selection: quote,
      selectionNote: note,
      selectionMetaLabel: task.label,
    })
  }

  const generateSummary = () => {
    if (!article) return
    startModuleAction({ actionId: 'rss.summarize_bullets' })
  }

  const handleCopyActionResult = async () => {
    if (actionResult.status !== 'ok') return
    try {
      await navigator.clipboard.writeText(actionResult.resultMarkdown)
    } catch {
      // ignore
    }
  }

  const handleEscalateActionResult = () => {
    if (!article || actionResult.status !== 'ok') return
    askAi(
      buildEscalateFromResultSeed({
        actionTitle: actionResult.title,
        articleTitle: article.title,
        articleId: article.id,
        resultMarkdown: actionResult.resultMarkdown,
      }),
    )
  }

  // Cache summarize Action output into the local AI summary card.
  useEffect(() => {
    if (actionResult.status !== 'ok') return
    if (actionResult.actionId !== 'rss.summarize_bullets') return
    if (!article || actionResult.articleId !== article.id) return
    const text = actionResult.resultMarkdown.trim()
    if (!text) return
    patchMeta({ summaryCache: text.slice(0, 1200) })
  }, [actionResult]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const onMouseUp = (e: MouseEvent) => {
    if ((e.target as Element | null)?.closest?.('[role="dialog"][aria-label="划线点评"]')) {
      return
    }
    if (!scrollRef.current || !bodyRef.current) {
      setSelectionDraft(null)
      return
    }
    const draft = buildSelectionDraft(bodyRef.current, scrollRef.current)
    if (!draft) {
      setSelectionDraft(null)
      setSelectionNote('')
      return
    }
    setSelectionDraft(draft)
    setSelectionNote('')
  }

  const handleUnderline = () => {
    if (!article || !selectionDraft) return
    const next = buildAnnotationFromDraft(selectionDraft, selectionNote)
    patchMeta({ annotations: [...annotationList, next] })
    closePopover()
  }

  const handleCopy = async () => {
    if (!selectionDraft) return
    try {
      await navigator.clipboard.writeText(selectionDraft.selectedText)
    } catch {
      // ignore
    }
  }

  const handleSendToAi = () => {
    if (!selectionDraft || !article) return
    const note = selectionNote.trim()
    openWithSelection(
      buildEscalateSelectionSeed({
        quote: selectionDraft.quote,
        note: note || undefined,
        articleTitle: article.title,
      }),
      selectionDraft.quote,
      '发给AI',
      note || undefined,
    )
  }

  const handleTranslateSelection = () => {
    if (!selectionDraft) return
    startModuleAction({
      actionId: 'rss.translate',
      selection: selectionDraft.quote,
      selectionNote: selectionNote.trim() || undefined,
      selectionMetaLabel: '翻译',
    })
  }

  const handleRewriteSelection = () => {
    if (!selectionDraft) return
    startModuleAction({
      actionId: 'rss.rewrite',
      selection: selectionDraft.quote,
      selectionNote: selectionNote.trim() || undefined,
      selectionMetaLabel: '中文改写',
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
            onScroll={() => {
              if (selectionDraft) closePopover()
            }}
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

              <ReadingChips
                onSelect={runReadingTask}
                disabled={
                  (!workspaceId && !activeWorkspaceId) ||
                  (actionResult.status === 'loading' &&
                    !!article &&
                    actionResult.articleId === article.id)
                }
              />

              {actionResult.status !== 'idle' &&
              article &&
              actionResult.articleId === article.id ? (
                <ActionResultPanel
                  state={actionResult}
                  onClose={() => {
                    beginActionRun()
                    setActionResult({ status: 'idle' })
                  }}
                  onCopy={() => void handleCopyActionResult()}
                  onEscalate={handleEscalateActionResult}
                  onRetry={
                    actionResult.status === 'error'
                      ? () =>
                          startModuleAction({
                            actionId: actionResult.actionId,
                          })
                      : undefined
                  }
                />
              ) : null}

              {activeSelection ? (
                <SelectedTextCard
                  context={activeSelection}
                  onDismiss={() => setActiveSelection(null)}
                />
              ) : null}

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
              {annotationList.length > 0 ? (
                <p className="mb-2 text-[10px] text-muted-foreground">
                  已划线 {annotationList.length} 处
                  <button
                    type="button"
                    className="ml-2 underline underline-offset-2 hover:text-foreground"
                    onClick={() => patchMeta({ annotations: [] })}
                  >
                    清除全部
                  </button>
                </p>
              ) : null}
              {bodyHtml ? (
                <div
                  ref={bodyRef}
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

            {selectionDraft ? (
              <SelectionPopover
                draft={selectionDraft}
                note={selectionNote}
                onNoteChange={setSelectionNote}
                onCopy={() => void handleCopy()}
                onSendToAi={handleSendToAi}
                onUnderline={handleUnderline}
                onTranslate={handleTranslateSelection}
                onRewrite={handleRewriteSelection}
                onClose={closePopover}
              />
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
