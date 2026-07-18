import { listSources, listTables, previewRows, uploadSourceFile } from '../tables/api'
import type { TablesQueryResult, TablesSource, TablesTableInfo } from '../tables/types'
import { filterSiteSources, siteSourceIdForFile } from './site-data-utils'

export {
  filterSiteSources,
  isSiteDataSource,
  siteDataSourcePrefix,
  siteSourceIdForFile,
} from './site-data-utils'

export async function listSiteSources(siteId: string): Promise<TablesSource[]> {
  const all = await listSources()
  return filterSiteSources(all, siteId)
}

export async function listSiteTables(sourceId: string): Promise<TablesTableInfo[]> {
  return listTables(sourceId)
}

export async function previewSiteRows(
  sourceId: string,
  table: string,
  opts?: { schema?: string; limit?: number },
): Promise<TablesQueryResult> {
  return previewRows(sourceId, table, opts)
}

/** Upload a file as a site-scoped Tables source (id = site-{siteId}-{slug}). */
export async function uploadSiteSourceFile(
  siteId: string,
  filePath: string,
  opts?: { name?: string },
): Promise<TablesSource> {
  const fileName = filePath.split(/[/\\]/).pop() || 'data'
  const id = siteSourceIdForFile(siteId, fileName)
  const baseName = fileName.replace(/\.[^.]+$/, '') || fileName
  const name = opts?.name ?? baseName
  return uploadSourceFile(filePath, { id, name, access: 'read' })
}

export async function pickAndUploadSiteSource(siteId: string): Promise<TablesSource | null> {
  if (!window.electronAPI?.openFileDialog) {
    throw new Error('File dialog unavailable')
  }
  const paths = await window.electronAPI.openFileDialog()
  const filePath = paths[0]
  if (!filePath) return null

  const allowed = /\.(csv|json|jsonl|parquet|xlsx|xls|sqlite|db|duckdb)$/i
  if (!allowed.test(filePath)) {
    throw new Error('Unsupported file type. Use csv, json, parquet, xlsx, sqlite, or duckdb.')
  }

  return uploadSiteSourceFile(siteId, filePath)
}
