import type { ModuleActionId } from '@grose-agent/shared/grose-modules/module-actions'
import type { ArticleBodySource } from '../local-meta'

export type { ArticleBodySource }

/** Chip / popup task id → Module Action id. */
export const READING_TASK_ACTION_IDS: Record<string, ModuleActionId> = {
  summarize: 'rss.summarize_bullets',
  structure: 'rss.structure',
  facts: 'rss.facts',
  verify: 'rss.verify',
  counter: 'rss.counterpoints',
  translate: 'rss.translate',
  premises: 'rss.premises',
  actions: 'rss.actions',
  'rewrite-zh': 'rss.rewrite',
  share: 'rss.share',
}

export type ReadingTask = {
  id: string
  label: string
  /** Module Action id run silently via `moduleActionsRun`. */
  actionId: ModuleActionId
  /** Shown in the primary chip row. */
  primary?: boolean
}

/**
 * Analysis chips inspired by qmreader AI_READING_TASKS + 翻译.
 * Primary chips match 图一; extras appear behind "…".
 * Click → Module Action runner (not Composer seed).
 */
export const READING_TASKS: ReadingTask[] = [
  {
    id: 'summarize',
    label: '总结要点',
    actionId: READING_TASK_ACTION_IDS.summarize,
    primary: true,
  },
  {
    id: 'structure',
    label: '结构拆解',
    actionId: READING_TASK_ACTION_IDS.structure,
    primary: true,
  },
  {
    id: 'facts',
    label: '事实清单',
    actionId: READING_TASK_ACTION_IDS.facts,
    primary: true,
  },
  {
    id: 'verify',
    label: '待验证点',
    actionId: READING_TASK_ACTION_IDS.verify,
    primary: true,
  },
  {
    id: 'counter',
    label: '反方观点',
    actionId: READING_TASK_ACTION_IDS.counter,
    primary: true,
  },
  {
    id: 'translate',
    label: '翻译',
    actionId: READING_TASK_ACTION_IDS.translate,
    primary: true,
  },
  {
    id: 'premises',
    label: '前提测试',
    actionId: READING_TASK_ACTION_IDS.premises,
  },
  {
    id: 'actions',
    label: '行动建议',
    actionId: READING_TASK_ACTION_IDS.actions,
  },
  {
    id: 'rewrite-zh',
    label: '中文改写',
    actionId: READING_TASK_ACTION_IDS['rewrite-zh'],
  },
  {
    id: 'share',
    label: '分享文案',
    actionId: READING_TASK_ACTION_IDS.share,
  },
]

export const PRIMARY_READING_TASKS = READING_TASKS.filter((t) => t.primary)
export const MORE_READING_TASKS = READING_TASKS.filter((t) => !t.primary)

export function findReadingTask(id: string): ReadingTask | undefined {
  return READING_TASKS.find((t) => t.id === id)
}

export function actionIdForReadingTask(task: ReadingTask | string): ModuleActionId | undefined {
  if (typeof task === 'string') return READING_TASK_ACTION_IDS[task]
  return task.actionId
}

export function formatSelectionMetaLabel(actionLabel: string, at = Date.now()): string {
  const d = new Date(at)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${actionLabel} · 读者 · ${mm}/${dd} ${hh}:${mi}`
}
