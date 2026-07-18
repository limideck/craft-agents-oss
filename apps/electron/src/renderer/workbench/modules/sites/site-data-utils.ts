import type { TablesSource } from '../tables/types'

/** Tables source ids for a site use this prefix so Data can share the Tables sidecar. */
export function siteDataSourcePrefix(siteId: string): string {
  return `site-${siteId}-`
}

export function isSiteDataSource(source: TablesSource, siteId: string): boolean {
  const prefix = siteDataSourcePrefix(siteId)
  return source.id === `site-${siteId}` || source.id.startsWith(prefix)
}

export function filterSiteSources(sources: TablesSource[], siteId: string): TablesSource[] {
  return sources.filter((s) => isSiteDataSource(s, siteId))
}

export function siteSourceIdForFile(siteId: string, fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').toLowerCase() || 'data'
  return `${siteDataSourcePrefix(siteId)}${base}`
}
