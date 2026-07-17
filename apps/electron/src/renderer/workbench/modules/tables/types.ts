/** Admin API shapes from the Tables (plydb) sidecar. */

export type TablesSourceAccess = 'read' | 'append' | 'read_write' | 'full_dml'

export type TablesSourceType = 'file' | 'sqlite' | 'duckdb' | string

export interface TablesSource {
  id: string
  type: TablesSourceType
  name: string
  description?: string
  path?: string
  format?: string
  access: TablesSourceAccess | string
}

export interface TablesTableInfo {
  catalog: string
  schema: string
  name: string
  fqn: string
  columns?: string[]
}

export interface TablesQueryResult {
  success: boolean
  columns?: string[]
  column_types?: string[]
  rows?: unknown[][]
  row_count: number
  truncated?: boolean
  message?: string
}

/** One preview row keyed by column id (+ stable `__rowId`). */
export type TablesGridRow = Record<string, unknown> & { __rowId: string }
