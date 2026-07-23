import { describe, expect, it } from 'bun:test'
import {
  buildAnnotationFromDraft,
  normalizeAnnotationText,
  quoteNeighborhood,
} from '../text-annotations'

describe('text-annotations helpers', () => {
  it('normalizes whitespace', () => {
    expect(normalizeAnnotationText('  hello\n\t world  ')).toBe('hello world')
  })

  it('extracts quote neighborhood', () => {
    const surface = 'aaa ' + 'x'.repeat(50) + ' TARGET quote here ' + 'y'.repeat(50) + ' zzz'
    const { prefix, suffix } = quoteNeighborhood(surface, 'TARGET quote here', 10)
    expect(prefix.length).toBeLessThanOrEqual(10)
    expect(suffix.length).toBeLessThanOrEqual(10)
    expect(prefix.endsWith('x') || prefix.includes('x')).toBe(true)
    expect(suffix.startsWith('y') || suffix.includes('y')).toBe(true)
  })

  it('returns empty neighborhood when quote missing', () => {
    expect(quoteNeighborhood('abc', 'zzz')).toEqual({ prefix: '', suffix: '' })
  })

  it('builds annotation from draft', () => {
    const ann = buildAnnotationFromDraft(
      { quote: '  hello  world  ', prefix: 'pre', suffix: 'suf' },
      '  a note  ',
    )
    expect(ann.quote).toBe('hello world')
    expect(ann.body).toBe('a note')
    expect(ann.prefix).toBe('pre')
    expect(ann.id.startsWith('ann_')).toBe(true)
    expect(ann.createdAt).toBeGreaterThan(0)
  })

  it('omits empty body', () => {
    const ann = buildAnnotationFromDraft({ quote: 'q', prefix: '', suffix: '' }, '   ')
    expect(ann.body).toBeUndefined()
  })
})
