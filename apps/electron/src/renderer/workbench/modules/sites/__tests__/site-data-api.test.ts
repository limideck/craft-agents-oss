import { describe, expect, it } from 'bun:test'
import {
  filterSiteSources,
  isSiteDataSource,
  siteDataSourcePrefix,
  siteSourceIdForFile,
} from '../site-data-utils'
import type { TablesSource } from '../tables/types'

function src(id: string, name = id): TablesSource {
  return { id, name, type: 'file', access: 'read' }
}

describe('site-data-utils', () => {
  it('builds site-scoped source ids', () => {
    expect(siteDataSourcePrefix('abc')).toBe('site-abc-')
    expect(siteSourceIdForFile('abc', 'orders.csv')).toBe('site-abc-orders')
  })

  it('filters sources belonging to a site', () => {
    const all = [
      src('site-abc-orders'),
      src('site-abc'),
      src('site-other-x'),
      src('catalog'),
    ]
    expect(filterSiteSources(all, 'abc').map((s) => s.id)).toEqual([
      'site-abc-orders',
      'site-abc',
    ])
    expect(isSiteDataSource(src('site-abc-orders'), 'abc')).toBe(true)
    expect(isSiteDataSource(src('site-other-x'), 'abc')).toBe(false)
  })
})
