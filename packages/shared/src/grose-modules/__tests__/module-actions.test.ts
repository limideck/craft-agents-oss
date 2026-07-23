import { describe, expect, it } from 'bun:test'
import {
  buildModuleActionInstruction,
  getModuleAction,
  instructionLooksLikeFullBodyPaste,
  isPrecleanedFullContentFeed,
  isPrecleanedFullContentFeedUrl,
  listModuleActions,
  matchesPrecleanedFeedUrlPrefix,
} from '../module-actions.ts'

describe('module actions registry', () => {
  it('lists rss actions including translate / summarize / structure', () => {
    const ids = listModuleActions('rss').map((a) => a.id)
    expect(ids).toContain('rss.translate')
    expect(ids).toContain('rss.summarize_bullets')
    expect(ids).toContain('rss.structure')
    expect(ids).toContain('rss.facts')
    expect(ids).toContain('rss.verify')
    expect(ids).toContain('rss.counterpoints')
    expect(ids).toContain('rss.rewrite')
  })

  it('builds article-scoped instruction with ids, not full body', () => {
    const action = getModuleAction('rss.summarize_bullets')!
    const hugeBody = 'FULL_ARTICLE_BODY_'.repeat(500)
    const instruction = buildModuleActionInstruction(action, {
      articleId: 'art-1',
      url: 'https://example.com/a',
      title: 'Hello',
      // Callers must not pass body; if they did somehow, it is ignored.
      selection: undefined,
    })

    expect(instruction).toContain('article_id: art-1')
    expect(instruction).toContain('url: https://example.com/a')
    expect(instruction).toContain('rss_get_article')
    expect(instruction).toContain('rss_fetch_article_content')
    expect(instruction.includes('{{')).toBe(false)
    expect(instruction).not.toContain(hugeBody)
    expect(instructionLooksLikeFullBodyPaste(instruction)).toBe(false)
    expect(instruction.length).toBeLessThan(2_000)
  })

  it('builds selection-scoped translate without requiring article body', () => {
    const action = getModuleAction('rss.translate')!
    const quote = 'Selected sentence only.'
    const instruction = buildModuleActionInstruction(action, {
      selection: quote,
    })

    expect(instruction).toContain(quote)
    expect(instruction).toContain('翻译')
    expect(instruction).not.toContain('rss_get_article')
    expect(instruction).not.toContain('文章正文：')
    expect(instructionLooksLikeFullBodyPaste(instruction)).toBe(false)
  })

  it('keeps MCP read path when articleId + selection both present', () => {
    const action = getModuleAction('rss.translate')!
    const instruction = buildModuleActionInstruction(action, {
      articleId: 'art-9',
      url: 'https://x.test/p',
      selection: 'bit',
    })
    expect(instruction).toContain('article_id: art-9')
    expect(instruction).toContain('rss_get_article')
    expect(instruction).toContain('bit')
  })

  it('for bryanmoyo pre-cleaned feeds: use rss_get_article only, forbid refetch', () => {
    const action = getModuleAction('rss.translate')!
    const feedUrl = 'https://vipuser.yzcw.dpdns.org/bryanmoyo/feed.xml'
    const instruction = buildModuleActionInstruction(action, {
      articleId: 'art-bryan',
      // Original publisher URL — agent must NOT fetch this for bryanmoyo feeds.
      url: 'https://www.nytimes.com/paywalled-article',
      feedUrl,
      title: 'Paywalled title',
    })

    expect(instruction).toContain('feed_url: ' + feedUrl)
    expect(instruction).toContain('rss_get_article')
    expect(instruction).toContain('清洗后的完整原文')
    expect(instruction).toContain('禁止调用 rss_fetch_article_content')
    expect(instruction).toContain('web_fetch')
    expect(instruction).toContain('不要当作截断')
    expect(instruction).not.toContain('若 content/summary 为空、过短或疑似截断')
    expect(instruction).not.toContain('再调用 rss_fetch_article_content')
  })

  it('matches pre-cleaned feed via article url / sourceUrl when feedUrl absent', () => {
    const action = getModuleAction('rss.summarize_bullets')!
    const viaUrl = buildModuleActionInstruction(action, {
      articleId: 'a1',
      url: 'HTTP://VIPUSER.YZCW.DPDNS.ORG/bryanmoyo/post/1',
    })
    expect(viaUrl).toContain('禁止调用 rss_fetch_article_content')

    const viaSource = buildModuleActionInstruction(action, {
      articleId: 'a2',
      url: 'https://example.com/elsewhere',
      sourceUrl: 'https://vipuser.yzcw.dpdns.org/bryanmoyo/',
    })
    expect(viaSource).toContain('禁止调用 rss_fetch_article_content')
  })

  it('keeps fetch-full-content fallback for non-allowlisted feeds', () => {
    const action = getModuleAction('rss.translate')!
    const instruction = buildModuleActionInstruction(action, {
      articleId: 'art-other',
      url: 'https://example.com/story',
      feedUrl: 'https://example.com/rss.xml',
    })
    expect(instruction).toContain('rss_fetch_article_content')
    expect(instruction).toContain('若 content/summary 为空、过短或疑似截断')
    expect(instruction).not.toContain('禁止调用 rss_fetch_article_content')
  })
})

describe('pre-cleaned full-content feed allowlist', () => {
  it('matches bryanmoyo prefix case-insensitively with http/https', () => {
    expect(
      isPrecleanedFullContentFeedUrl('https://vipuser.yzcw.dpdns.org/bryanmoyo/'),
    ).toBe(true)
    expect(
      isPrecleanedFullContentFeedUrl('http://VIPUSER.YZCW.DPDNS.ORG/bryanmoyo/rss.xml'),
    ).toBe(true)
    expect(
      isPrecleanedFullContentFeedUrl('https://vipuser.yzcw.dpdns.org/bryanmoyo'),
    ).toBe(true)
    expect(
      isPrecleanedFullContentFeedUrl('https://vipuser.yzcw.dpdns.org/other/'),
    ).toBe(false)
    expect(
      isPrecleanedFullContentFeedUrl('https://vipuser.yzcw.dpdns.org/bryanmoyox/'),
    ).toBe(false)
  })

  it('prefers feedUrl over unrelated article url', () => {
    expect(
      isPrecleanedFullContentFeed({
        feedUrl: 'https://vipuser.yzcw.dpdns.org/bryanmoyo/feed',
        url: 'https://www.ft.com/content/abc',
      }),
    ).toBe(true)
    expect(
      isPrecleanedFullContentFeed({
        feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
        url: 'https://www.bbc.com/news/1',
      }),
    ).toBe(false)
  })

  it('enforces path-boundary prefix matching', () => {
    expect(
      matchesPrecleanedFeedUrlPrefix(
        'https://vipuser.yzcw.dpdns.org/bryanmoyo/x',
        'https://vipuser.yzcw.dpdns.org/bryanmoyo/',
      ),
    ).toBe(true)
    expect(
      matchesPrecleanedFeedUrlPrefix(
        'https://vipuser.yzcw.dpdns.org/bryanmoyox',
        'https://vipuser.yzcw.dpdns.org/bryanmoyo/',
      ),
    ).toBe(false)
  })
})
