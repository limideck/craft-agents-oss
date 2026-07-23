import { describe, expect, it } from 'bun:test'
import { resolveArticleBodyText } from '../../local-meta'
import {
  PRIMARY_READING_TASKS,
  READING_TASK_ACTION_IDS,
  READING_TASKS,
  actionIdForReadingTask,
  findReadingTask,
  formatSelectionMetaLabel,
} from '../reading-tasks'
import {
  buildEscalateFromResultSeed,
  buildEscalateSelectionSeed,
  truncateForEscalate,
} from '../run-module-action'

describe('reading-tasks', () => {
  it('exposes primary chips matching 图一 + 翻译', () => {
    const labels = PRIMARY_READING_TASKS.map((t) => t.label)
    expect(labels).toEqual([
      '总结要点',
      '结构拆解',
      '事实清单',
      '待验证点',
      '反方观点',
      '翻译',
    ])
  })

  it('finds tasks by id', () => {
    expect(findReadingTask('counter')?.label).toBe('反方观点')
    expect(findReadingTask('missing')).toBeUndefined()
  })

  it('maps every chip task id to an rss.* Module Action id', () => {
    expect(READING_TASK_ACTION_IDS).toEqual({
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
    })
    for (const task of READING_TASKS) {
      expect(task.actionId).toBe(READING_TASK_ACTION_IDS[task.id])
      expect(actionIdForReadingTask(task)).toBe(task.actionId)
      expect(actionIdForReadingTask(task.id)).toBe(task.actionId)
    }
  })

  it('formats selection meta labels', () => {
    const label = formatSelectionMetaLabel('中文改写', new Date('2026-07-22T14:17:00Z').getTime())
    expect(label.startsWith('中文改写 · 读者 · ')).toBe(true)
  })

  it('keeps extra tasks behind primary set', () => {
    expect(READING_TASKS.length).toBeGreaterThan(PRIMARY_READING_TASKS.length)
  })
})

describe('escalate seeds', () => {
  it('builds a short escalate seed from Action result without MCP playbook', () => {
    const seed = buildEscalateFromResultSeed({
      actionTitle: '翻译',
      articleTitle: 'Hello',
      articleId: 'art-1',
      resultMarkdown: '译文段落一。\n\n译文段落二。',
    })
    expect(seed).toContain('继续讨论刚才「翻译」的结果')
    expect(seed).toContain('文章：Hello')
    expect(seed).toContain('article_id: art-1')
    expect(seed).toContain('译文段落一')
    expect(seed).not.toContain('rss_get_article')
    expect(seed).not.toContain('grose-modules MCP')
    expect(seed).not.toContain('请把内容翻译成')
  })

  it('truncates long result excerpts for escalate', () => {
    const long = 'x'.repeat(900)
    const seed = buildEscalateFromResultSeed({
      actionTitle: '总结要点',
      resultMarkdown: long,
    })
    expect(seed).toContain('…')
    expect(seed.length).toBeLessThan(long.length)
    expect(truncateForEscalate(long, 100).length).toBeLessThanOrEqual(101)
  })

  it('builds a short selection escalate seed (quote only)', () => {
    const seed = buildEscalateSelectionSeed({
      quote: 'Hello world',
      note: 'interesting',
      articleTitle: 'Post',
    })
    expect(seed).toContain('关于「Post」的选中片段')
    expect(seed).toContain('> Hello world')
    expect(seed).toContain('点评：interesting')
    expect(seed).toContain('【用户问题】')
    expect(seed).not.toContain('rss_get_article')
    expect(seed).not.toContain('请把下面内容翻译')
  })
})

describe('resolveArticleBodyText', () => {
  it('prefers full body/content over RSS summary', () => {
    const resolved = resolveArticleBodyText({
      content: '<p>Full body content that is much longer than the feed blurb.</p>',
      summary: 'Short summary only.',
    })
    expect(resolved.source).toBe('body')
    expect(resolved.text).toContain('Full body content')
    expect(resolved.text).not.toBe('Short summary only.')
  })

  it('prefers bodyHtml override over content and summary', () => {
    const resolved = resolveArticleBodyText({
      bodyHtml: '<p>Fetched readability body</p>',
      content: '<p>RSS content</p>',
      summary: 'RSS summary',
    })
    expect(resolved.source).toBe('body')
    expect(resolved.text).toContain('Fetched readability body')
  })

  it('falls back to summary when body is empty', () => {
    const resolved = resolveArticleBodyText({
      content: '',
      summary: '<p>Feed description excerpt</p>',
    })
    expect(resolved.source).toBe('summary')
    expect(resolved.text).toBe('Feed description excerpt')
  })

  it('returns empty when neither body nor summary exists', () => {
    expect(resolveArticleBodyText({})).toEqual({ text: '', source: 'empty' })
  })
})
