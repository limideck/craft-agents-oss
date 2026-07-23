/**
 * Module Action registry — silent UI tasks (translate, summarize, …).
 *
 * Instructions are hidden from Composer; they reference article ids / urls /
 * selection placeholders so the agent loads body via grose-modules MCP.
 * See docs/grose-modules-agent-routing.md (Layer 4: Module Actions).
 */

import { PRECLEANED_FULL_CONTENT_FEED_URL_PREFIXES } from './constants.ts'
import type { GroseBuiltinModuleId } from './types.ts'

/** Known Reader / RSS action ids; open string union for future modules. */
export type ModuleActionId =
  | 'rss.translate'
  | 'rss.summarize_bullets'
  | 'rss.structure'
  | 'rss.facts'
  | 'rss.verify'
  | 'rss.counterpoints'
  | 'rss.premises'
  | 'rss.actions'
  | 'rss.rewrite'
  | 'rss.share'
  | (string & {})

export type ModuleActionResultUi = 'inline-panel' | 'toast' | 'annotation'

export type ModuleActionScope = 'article' | 'selection' | 'article_or_selection'

export type ModuleActionDef = {
  id: ModuleActionId
  moduleId: GroseBuiltinModuleId
  title: string
  /**
   * Hidden task instruction (no article body). Composed with MCP/selection
   * context by `buildModuleActionInstruction`. May still use placeholders
   * `{{articleId}}` `{{url}}` `{{title}}` `{{selection}}` `{{selectionNote}}`
   * if you need them inside the task line.
   */
  instruction: string
  /** Optional skill slug for deeper playbooks */
  skillSlug?: string
  /** Preferred MCP tool name prefixes (e.g. rss_) */
  toolPrefixes?: string[]
  resultUi: ModuleActionResultUi
  scope: ModuleActionScope
}

export type ModuleActionParams = {
  articleId?: string
  /** Article permalink (may be original publisher URL). */
  url?: string
  /**
   * Subscription feed URL. Preferred signal for pre-cleaned full-content feeds
   * (article `url` may still point at a paywalled original).
   */
  feedUrl?: string
  /** Optional feed homepage / alternate source URL for allowlist matching. */
  sourceUrl?: string
  title?: string
  selection?: string
  selectionNote?: string
}

/** Normalize for prefix match: trim, lower-case, http→https. */
function normalizeFeedUrlForMatch(raw: string): string {
  let u = raw.trim().toLowerCase()
  if (u.startsWith('http://')) {
    u = `https://${u.slice('http://'.length)}`
  }
  return u
}

/**
 * Path-prefix match against a cleaned-feed allowlist entry.
 * `https://host/path/` matches that exact path and any deeper path;
 * does not match `https://host/pathEvil`.
 */
export function matchesPrecleanedFeedUrlPrefix(url: string, prefix: string): boolean {
  const nUrl = normalizeFeedUrlForMatch(url)
  const nPrefix = normalizeFeedUrlForMatch(prefix)
  const withSlash = nPrefix.endsWith('/') ? nPrefix : `${nPrefix}/`
  return nUrl === withSlash.slice(0, -1) || nUrl.startsWith(withSlash)
}

/** True when a single URL belongs to a pre-cleaned full-content feed. */
export function isPrecleanedFullContentFeedUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false
  return PRECLEANED_FULL_CONTENT_FEED_URL_PREFIXES.some((prefix) =>
    matchesPrecleanedFeedUrlPrefix(url, prefix),
  )
}

/**
 * True when feedUrl / article url / sourceUrl matches a pre-cleaned allowlist
 * prefix. Prefer feedUrl — article links often still point at the original.
 */
export function isPrecleanedFullContentFeed(
  params: Pick<ModuleActionParams, 'feedUrl' | 'url' | 'sourceUrl'>,
): boolean {
  return (
    isPrecleanedFullContentFeedUrl(params.feedUrl) ||
    isPrecleanedFullContentFeedUrl(params.url) ||
    isPrecleanedFullContentFeedUrl(params.sourceUrl)
  )
}

const MCP_READ_LINES = [
  '请先通过 grose-modules MCP 调用 rss_get_article（传入 id={{articleId}}；workspace_id 取自会话 <grose_modules>）读取全文 content。',
  '若 content/summary 为空、过短或疑似截断，再调用 rss_fetch_article_content（url={{url}}）抓取可读全文。',
  '不要猜测或编造正文；读完后再完成任务。',
  '（正文由 MCP 工具读取，勿要求用户粘贴全文。）',
]

/** For feeds that already embed cleaned full text in RSS — never refetch. */
const MCP_READ_LINES_PRECLEANED = [
  '请先通过 grose-modules MCP 调用 rss_get_article（传入 id={{articleId}}；workspace_id 取自会话 <grose_modules>）读取全文 content。',
  '该订阅源已提供清洗后的完整原文：rss_get_article 返回的 content 即为全文，是唯一可信来源。',
  '禁止调用 rss_fetch_article_content、web_fetch，或搜索/抓取其它来源补全文。',
  '即使 content 看起来偏短，也不要当作截断或残缺；直接基于该 content 完成任务。',
  '不要猜测或编造正文；读完后再完成任务。',
  '（正文由 MCP 工具读取，勿要求用户粘贴全文。）',
]

const RSS_ACTIONS: readonly ModuleActionDef[] = [
  {
    id: 'rss.summarize_bullets',
    moduleId: 'rss',
    title: '总结要点',
    scope: 'article',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '用 5 条 bullet 总结这篇文章最值得关注的观点。',
  },
  {
    id: 'rss.structure',
    moduleId: 'rss',
    title: '结构拆解',
    scope: 'article',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '把这篇文章的论证结构拆成：问题、证据、结论、隐含假设。',
  },
  {
    id: 'rss.facts',
    moduleId: 'rss',
    title: '事实清单',
    scope: 'article',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '把文章里的关键事实、数据、案例列出来，并逐条说明它们分别证明了什么。',
  },
  {
    id: 'rss.verify',
    moduleId: 'rss',
    title: '待验证点',
    scope: 'article',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '这篇文章有哪些值得怀疑或需要验证的地方？按重要性排序。',
  },
  {
    id: 'rss.counterpoints',
    moduleId: 'rss',
    title: '反方观点',
    scope: 'article',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '站在反方立场，指出这篇文章最可能被挑战的 5 个点。',
  },
  {
    id: 'rss.premises',
    moduleId: 'rss',
    title: '前提测试',
    scope: 'article',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '这篇文章的论证依赖哪些前提？哪些前提一旦不成立，结论就会变弱？',
  },
  {
    id: 'rss.actions',
    moduleId: 'rss',
    title: '行动建议',
    scope: 'article',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '如果我是产品创作者，读完这篇文章下一步可以做什么？给 3–5 条可执行建议。',
  },
  {
    id: 'rss.share',
    moduleId: 'rss',
    title: '分享文案',
    scope: 'article',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '帮我写一段适合发到社交媒体的中文分享文案，短一点但有观点。',
  },
  {
    id: 'rss.translate',
    moduleId: 'rss',
    title: '翻译',
    scope: 'article_or_selection',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '请把内容翻译成流畅的中文，保留专有名词。',
  },
  {
    id: 'rss.rewrite',
    moduleId: 'rss',
    title: '中文改写',
    scope: 'article_or_selection',
    resultUi: 'inline-panel',
    toolPrefixes: ['rss_'],
    instruction: '请把内容改写成逻辑清晰、读感流畅的中文，保持原意。',
  },
]

const BY_ID = new Map<string, ModuleActionDef>(RSS_ACTIONS.map((a) => [a.id, a]))

export function listModuleActions(moduleId?: GroseBuiltinModuleId): ModuleActionDef[] {
  if (!moduleId) return [...RSS_ACTIONS]
  return RSS_ACTIONS.filter((a) => a.moduleId === moduleId)
}

export function getModuleAction(actionId: string): ModuleActionDef | undefined {
  return BY_ID.get(actionId)
}

const PLACEHOLDER_KEYS = [
  'articleId',
  'url',
  'feedUrl',
  'sourceUrl',
  'title',
  'selection',
  'selectionNote',
] as const

function fillPlaceholders(template: string, params: ModuleActionParams): string {
  let text = template
  for (const key of PLACEHOLDER_KEYS) {
    const value = (params[key] ?? '').trim()
    text = text.replaceAll(`{{${key}}}`, value)
  }
  return text
}

function buildArticleContext(params: ModuleActionParams): string {
  const lines: string[] = []
  const title = params.title?.trim()
  if (title) {
    lines.push(`关于文章「${title}」：`, '')
  }
  lines.push(`article_id: ${params.articleId!.trim()}`)
  const url = params.url?.trim()
  if (url) lines.push(`url: ${url}`)
  const feedUrl = params.feedUrl?.trim()
  if (feedUrl) lines.push(`feed_url: ${feedUrl}`)
  const sourceUrl = params.sourceUrl?.trim()
  if (sourceUrl) lines.push(`source_url: ${sourceUrl}`)
  const readLines = isPrecleanedFullContentFeed(params)
    ? MCP_READ_LINES_PRECLEANED
    : MCP_READ_LINES
  lines.push('', ...readLines)
  return fillPlaceholders(lines.join('\n'), params)
}

function buildSelectionContext(params: ModuleActionParams): string {
  const lines = [
    '【当前引用上下文】',
    '类型：选中文本',
    `引用：${params.selection!.trim()}`,
  ]
  const note = params.selectionNote?.trim()
  if (note) lines.push(`说明：${note}`)
  return lines.join('\n')
}

/**
 * Compose hidden instruction: selection and/or article MCP refs + task text.
 * Never embeds full article body — agent must read via grose-modules MCP.
 */
export function buildModuleActionInstruction(
  action: ModuleActionDef,
  params: ModuleActionParams,
): string {
  const hasSelection = Boolean(params.selection?.trim())
  const hasArticleId = Boolean(params.articleId?.trim())
  const parts: string[] = []

  if (hasSelection) {
    parts.push(buildSelectionContext(params))
  }

  // Article MCP context when we have an id (including selection+article escalate).
  // Selection-only runs skip MCP so we do not send empty article_id / url.
  if (hasArticleId) {
    if (parts.length) parts.push('')
    parts.push(buildArticleContext(params))
  }

  if (parts.length) parts.push('')
  parts.push(fillPlaceholders(action.instruction, params))

  return parts.join('\n').trim()
}

/**
 * True when the built instruction looks like it embeds a large pasted body
 * rather than id/url/selection refs. Used by tests / guards.
 */
export function instructionLooksLikeFullBodyPaste(instruction: string): boolean {
  const lower = instruction.toLowerCase()
  if (lower.includes('文章正文：')) return true
  // Heuristic: very long prompt without article_id / rss_get_article is suspicious.
  if (
    instruction.length > 8_000 &&
    !instruction.includes('article_id:') &&
    !instruction.includes('rss_get_article')
  ) {
    return true
  }
  return false
}
