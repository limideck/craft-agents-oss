import type { ModuleActionRunResponse } from '@grose-agent/shared/protocol'
import { getModuleAction } from '@grose-agent/shared/grose-modules/module-actions'
import { READING_TASK_ACTION_IDS, findReadingTask } from './reading-tasks'

export type RssActionResultState =
  | { status: 'idle' }
  | {
      status: 'loading'
      articleId: string
      actionId: string
      title: string
    }
  | {
      status: 'ok'
      articleId: string
      actionId: string
      title: string
      resultMarkdown: string
    }
  | {
      status: 'error'
      articleId: string
      actionId: string
      title: string
      error: string
    }

export type RunReadingModuleActionParams = {
  workspaceId: string
  actionId: string
  articleId: string
  url?: string
  /** Subscription feed URL — detects pre-cleaned full-content feeds. */
  feedUrl?: string
  sourceUrl?: string
  title?: string
  selection?: string
  selectionNote?: string
  onState: (state: RssActionResultState) => void
}

/** Shared generation so Reader + ⌘K invalidate each other's in-flight runs. */
let actionRunGeneration = 0

export function beginActionRun(): number {
  return ++actionRunGeneration
}

export function isActionRunStale(token: number): boolean {
  return token !== actionRunGeneration
}

function resolveActionTitle(actionId: string): string {
  const fromRegistry = getModuleAction(actionId)?.title
  if (fromRegistry) return fromRegistry
  const taskEntry = Object.entries(READING_TASK_ACTION_IDS).find(([, id]) => id === actionId)
  if (taskEntry) {
    const task = findReadingTask(taskEntry[0])
    if (task) return task.label
  }
  return actionId
}

/**
 * Call `moduleActionsRun` and drive the Reader result-panel state.
 * Never seeds Composer with the hidden Action instruction.
 */
export async function runReadingModuleAction(
  params: RunReadingModuleActionParams,
): Promise<ModuleActionRunResponse | null> {
  const actionTitle = resolveActionTitle(params.actionId)
  const runToken = beginActionRun()

  params.onState({
    status: 'loading',
    articleId: params.articleId,
    actionId: params.actionId,
    title: actionTitle,
  })

  const api = window.electronAPI?.moduleActionsRun
  if (!api) {
    const error = 'Module Actions API unavailable'
    if (!isActionRunStale(runToken)) {
      params.onState({
        status: 'error',
        articleId: params.articleId,
        actionId: params.actionId,
        title: actionTitle,
        error,
      })
    }
    return null
  }

  try {
    const res = await api(params.workspaceId, {
      actionId: params.actionId,
      articleId: params.articleId,
      url: params.url,
      feedUrl: params.feedUrl,
      sourceUrl: params.sourceUrl,
      title: params.title,
      selection: params.selection,
      selectionNote: params.selectionNote,
    })
    if (isActionRunStale(runToken)) return res

    if (res.ok) {
      params.onState({
        status: 'ok',
        articleId: params.articleId,
        actionId: params.actionId,
        title: actionTitle,
        resultMarkdown: res.resultMarkdown,
      })
    } else {
      params.onState({
        status: 'error',
        articleId: params.articleId,
        actionId: params.actionId,
        title: actionTitle,
        error: res.error || 'Action failed',
      })
    }
    return res
  } catch (err) {
    if (isActionRunStale(runToken)) return null
    params.onState({
      status: 'error',
      articleId: params.articleId,
      actionId: params.actionId,
      title: actionTitle,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

const ESCALATE_EXCERPT_MAX = 600

/** Short Composer seed when escalating an Action result to Chat — not the MCP playbook. */
export function buildEscalateFromResultSeed(opts: {
  actionTitle: string
  articleTitle?: string
  articleId?: string
  resultMarkdown: string
}): string {
  const lines: string[] = []
  const title = opts.articleTitle?.trim()
  if (title) {
    lines.push(`继续讨论刚才「${opts.actionTitle}」的结果（文章：${title}）。`)
  } else {
    lines.push(`继续讨论刚才「${opts.actionTitle}」的结果。`)
  }
  if (opts.articleId?.trim()) {
    lines.push(`article_id: ${opts.articleId.trim()}`)
  }
  lines.push('', '结果摘要：', truncateForEscalate(opts.resultMarkdown, ESCALATE_EXCERPT_MAX))
  return lines.join('\n')
}

/** Short Composer seed for selection “发给AI” — quote only, no Action instruction. */
export function buildEscalateSelectionSeed(opts: {
  quote: string
  note?: string
  articleTitle?: string
}): string {
  const lines: string[] = []
  const title = opts.articleTitle?.trim()
  if (title) {
    lines.push(`关于「${title}」的选中片段，我想继续讨论：`, '')
  } else {
    lines.push('关于选中片段，我想继续讨论：', '')
  }
  lines.push(`> ${opts.quote.trim()}`)
  const note = opts.note?.trim()
  if (note) {
    lines.push('', `点评：${note}`)
  }
  lines.push('', '【用户问题】')
  return lines.join('\n')
}

export function truncateForEscalate(text: string, max = ESCALATE_EXCERPT_MAX): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).trimEnd()}…`
}
