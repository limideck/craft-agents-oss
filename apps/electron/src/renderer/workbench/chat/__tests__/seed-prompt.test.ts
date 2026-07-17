import { describe, expect, it } from 'bun:test'
import { buildSeedFromContext, resolveSeedPrompt, titleFromContext } from '../seed-prompt'

describe('buildSeedFromContext', () => {
  it('returns undefined for plain / missing context', () => {
    expect(buildSeedFromContext()).toBeUndefined()
    expect(buildSeedFromContext({ type: 'plain' })).toBeUndefined()
  })

  it('builds an rss-article seed', () => {
    const seed = buildSeedFromContext({
      type: 'rss-article',
      articleId: 'a1',
      title: 'Hello',
      feedTitle: 'Feed',
      url: 'https://example.com/a',
    })
    expect(seed).toContain('"Hello"')
    expect(seed).toContain('Feed')
    expect(seed).toContain('https://example.com/a')
  })

  it('prefers explicit seedPrompt', () => {
    expect(
      resolveSeedPrompt('Custom', {
        type: 'rss-article',
        articleId: 'a1',
        title: 'Hello',
      }),
    ).toBe('Custom')
  })

  it('titles from context', () => {
    expect(titleFromContext({ type: 'rss-article', articleId: 'a1', title: 'Hello' })).toBe(
      'Ask: Hello',
    )
    expect(titleFromContext({ type: 'plain' })).toBe('Chat')
  })
})
