import type { GroseModulesRssArticle } from '@grose-agent/shared/grose-modules/types'
import type { ReaderArticleMeta, ReaderLibraryId, ReaderStatus } from './store'

export const DEFAULT_READER_TAGS = [
  'AI',
  '设计',
  '研究',
  '产品',
  'local-first',
  '软件',
  '笔记',
] as const

export const TAG_COLORS: Record<string, string> = {
  AI: '#7c6bc4',
  设计: '#5b8def',
  Design: '#5b8def',
  研究: '#3d9a6a',
  Research: '#3d9a6a',
  产品: '#c45b8a',
  Product: '#c45b8a',
  'local-first': '#4a90a4',
  软件: '#6b7280',
  software: '#6b7280',
  笔记: '#8b7ec8',
  notes: '#8b7ec8',
  Writing: '#c47a3a',
  写作: '#c47a3a',
  macOS: '#6b7280',
  philosophy: '#9a7b4a',
  哲学: '#9a7b4a',
}

export function getArticleMeta(
  metaById: Record<string, ReaderArticleMeta>,
  articleId: string,
): ReaderArticleMeta {
  return metaById[articleId] ?? {}
}

export function defaultStatusForArticle(_article: GroseModulesRssArticle): ReaderStatus {
  return 'unread'
}

export function effectiveStatus(
  article: GroseModulesRssArticle,
  meta: ReaderArticleMeta,
): ReaderStatus {
  return meta.status ?? defaultStatusForArticle(article)
}

export function matchesLibrary(
  article: GroseModulesRssArticle,
  meta: ReaderArticleMeta,
  libraryId: ReaderLibraryId,
): boolean {
  switch (libraryId) {
    case 'unread':
      return effectiveStatus(article, meta) === 'unread'
    case 'history':
      return meta.lastViewedAt != null
    default:
      return true
  }
}

export function filterArticlesByLocalSelection(
  articles: GroseModulesRssArticle[],
  metaById: Record<string, ReaderArticleMeta>,
  selection: { kind: 'library'; id: ReaderLibraryId } | { kind: 'tag'; tag: string },
): GroseModulesRssArticle[] {
  if (selection.kind === 'library') {
    const filtered = articles.filter((a) =>
      matchesLibrary(a, getArticleMeta(metaById, a.id), selection.id),
    )
    if (selection.id === 'history') {
      return [...filtered].sort((a, b) => {
        const ta = getArticleMeta(metaById, a.id).lastViewedAt ?? 0
        const tb = getArticleMeta(metaById, b.id).lastViewedAt ?? 0
        return tb - ta
      })
    }
    return filtered
  }
  return articles.filter((a) => (getArticleMeta(metaById, a.id).tags ?? []).includes(selection.tag))
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function excerptFromArticle(article: GroseModulesRssArticle, max = 140): string {
  const raw = article.summary || article.content || ''
  const text = stripHtml(raw)
  if (text.length <= max) return text
  return `${text.slice(0, max).trim()}…`
}

export type ArticleBodySource = 'body' | 'summary' | 'empty'

/**
 * Resolve plain text for AI reading tasks.
 * Prefers full article body (override / fetched HTML / content) over RSS summary/excerpt.
 */
export function resolveArticleBodyText(input: {
  /** Body HTML only — do not pass summary-fallback display HTML here. */
  bodyHtml?: string | null
  content?: string | null
  summary?: string | null
}): { text: string; source: ArticleBodySource } {
  const bodyText = stripHtml(input.bodyHtml || input.content || '')
  if (bodyText) return { text: bodyText, source: 'body' }
  const summaryText = stripHtml(input.summary || '')
  if (summaryText) return { text: summaryText, source: 'summary' }
  return { text: '', source: 'empty' }
}

export type ArticleTypeFilter = 'all' | 'web' | 'podcast'

export function articleType(article: GroseModulesRssArticle): 'web' | 'podcast' {
  return article.audioUrl ? 'podcast' : 'web'
}

export function libraryLabel(id: ReaderLibraryId): string {
  switch (id) {
    case 'unread':
      return '未读'
    case 'history':
      return '历史'
    default:
      return '资料库'
  }
}

/** Keyword rules for auto-tagging (local heuristic; no LLM). */
const AUTO_TAG_RULES: { tag: string; keys: string[] }[] = [
  { tag: 'AI', keys: ['ai', 'agent', 'llm', 'gpt', 'claude', '智能体', '大模型', 'openai', 'anthropic'] },
  { tag: '设计', keys: ['design', 'ui', 'ux', '设计', '交互', '视觉', 'figma'] },
  { tag: '研究', keys: ['research', '研究', '论文', 'paper', 'survey'] },
  { tag: '产品', keys: ['product', '产品', 'roadmap', 'pm'] },
  { tag: 'local-first', keys: ['local-first', 'local first', '本地优先', 'crdt', 'offline'] },
  { tag: '软件', keys: ['software', '软件', 'engineering', '工程', 'code', '编程'] },
  { tag: '笔记', keys: ['note', '笔记', 'memo', 'markdown'] },
]

/**
 * Suggest tags from title / summary / feed name.
 * Returns tags that match rules and exist in `availableTags` (or always for rule tags).
 */
export function suggestAutoTags(
  article: GroseModulesRssArticle,
  availableTags: string[] = [...DEFAULT_READER_TAGS],
): string[] {
  const hay = `${article.title} ${article.summary ?? ''} ${article.feedName ?? ''} ${article.author ?? ''}`.toLowerCase()
  const found: string[] = []
  for (const rule of AUTO_TAG_RULES) {
    if (rule.keys.some((k) => hay.includes(k.toLowerCase()))) {
      found.push(rule.tag)
    }
  }
  return Array.from(
    new Set(found.filter((t) => availableTags.includes(t) || AUTO_TAG_RULES.some((r) => r.tag === t))),
  )
}
