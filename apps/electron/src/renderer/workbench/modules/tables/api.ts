/**
 * Thin Admin HTTP client via Electron IPC `tablesFetch` (never call sidecar from renderer).
 */

import type { TablesFetchRequest } from '../../../../shared/tables'
import type {
  TablesQueryResult,
  TablesSource,
  TablesSourceAccess,
  TablesTableInfo,
} from './types'

function hasTablesApi(): boolean {
  return typeof window.electronAPI?.tablesFetch === 'function'
}

async function tablesFetch(request: TablesFetchRequest) {
  if (!hasTablesApi()) {
    throw new Error('Tables API unavailable')
  }
  return window.electronAPI.tablesFetch(request)
}

async function parseJson<T>(res: { status: number; body: string }, label: string): Promise<T> {
  if (res.status < 200 || res.status >= 300) {
    let detail = res.body
    try {
      const err = JSON.parse(res.body) as { error?: string; message?: string }
      detail = err.error ?? err.message ?? res.body
    } catch {
      // keep raw body
    }
    throw new Error(`${label} failed (${res.status}): ${detail || 'unknown error'}`)
  }
  if (!res.body) return {} as T
  return JSON.parse(res.body) as T
}

/** Ensure sidecar is up and MCP source is registered for local workspaces. */
export async function ensureTablesReady(): Promise<{ ready: boolean; error?: string }> {
  if (!window.electronAPI?.getTablesConfig) {
    return { ready: false, error: 'Tables API unavailable' }
  }
  try {
    const config = await window.electronAPI.getTablesConfig()
    return { ready: config.ready }
  } catch (err) {
    return {
      ready: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function listSources(): Promise<TablesSource[]> {
  const res = await tablesFetch({ method: 'GET', path: '/api/sources' })
  const data = await parseJson<{ sources: TablesSource[] }>(res, 'List sources')
  return data.sources ?? []
}

export async function deleteSource(id: string, deleteFiles = true): Promise<void> {
  const q = deleteFiles ? '?delete_files=1' : '?delete_files=0'
  const res = await tablesFetch({
    method: 'DELETE',
    path: `/api/sources/${encodeURIComponent(id)}${q}`,
  })
  await parseJson<{ ok: boolean }>(res, 'Delete source')
}

export async function setSourceAccess(
  id: string,
  access: TablesSourceAccess,
): Promise<TablesSource> {
  const res = await tablesFetch({
    method: 'PATCH',
    path: `/api/sources/${encodeURIComponent(id)}`,
    body: JSON.stringify({ access }),
  })
  return parseJson<TablesSource>(res, 'Update access')
}

export async function listTables(sourceId: string): Promise<TablesTableInfo[]> {
  const res = await tablesFetch({
    method: 'GET',
    path: `/api/sources/${encodeURIComponent(sourceId)}/tables`,
  })
  const data = await parseJson<{ tables: TablesTableInfo[] }>(res, 'List tables')
  return data.tables ?? []
}

export async function previewRows(
  sourceId: string,
  table: string,
  opts?: { schema?: string; limit?: number },
): Promise<TablesQueryResult> {
  const schema = opts?.schema ?? 'default'
  const limit = opts?.limit ?? 100
  const params = new URLSearchParams({ schema, limit: String(limit) })
  const res = await tablesFetch({
    method: 'GET',
    path: `/api/sources/${encodeURIComponent(sourceId)}/tables/${encodeURIComponent(table)}/rows?${params}`,
  })
  return parseJson<TablesQueryResult>(res, 'Preview rows')
}

/** Upload a file from disk via main-process multipart (path never leaves main for the HTTP body). */
export async function uploadSourceFile(
  filePath: string,
  opts?: { id?: string; name?: string; access?: TablesSourceAccess },
): Promise<TablesSource> {
  const fileName = filePath.split(/[/\\]/).pop() || 'upload'
  const fields: Record<string, string> = {}
  if (opts?.id) fields.id = opts.id
  if (opts?.name) fields.name = opts.name
  if (opts?.access) fields.access = opts.access

  const res = await tablesFetch({
    method: 'POST',
    path: '/api/sources/upload',
    multipart: {
      fields,
      file: { fileName, filePath },
    },
  })
  return parseJson<TablesSource>(res, 'Upload source')
}

/** Pick a data file via the native dialog, then upload. Returns null if canceled. */
export async function pickAndUploadSource(): Promise<TablesSource | null> {
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

  const base = filePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'data'
  return uploadSourceFile(filePath, { name: base })
}
