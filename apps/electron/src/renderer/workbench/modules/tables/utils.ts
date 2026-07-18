import type { ColumnDef } from '@tanstack/react-table'
import {
  getDataGridSelectColumn,
  getFilterFn,
  type CellOpts,
} from '@grose-agent/datagrid'
import type { TablesGridRow, TablesQueryResult, TablesSource } from './types'

const filterFn = getFilterFn<TablesGridRow>()

/** File sources are always read-only at the engine; sqlite/duckdb may be writable via MCP SQL. */
export function isPreviewWritable(source: TablesSource | null | undefined): boolean {
  if (!source) return false
  const type = source.type.toLowerCase()
  if (type !== 'sqlite' && type !== 'duckdb') return false
  const access = source.access.toLowerCase()
  return access === 'read_write' || access === 'full_dml' || access === 'append'
}

/** Phase 1 grid is preview-only — no Admin DML for cell edits yet. */
export function shouldGridBeReadOnly(_source: TablesSource | null | undefined): boolean {
  return true
}

function variantForSqlType(sqlType: string | undefined): CellOpts['variant'] {
  const t = (sqlType ?? '').toUpperCase()
  if (
    t.includes('INT') ||
    t.includes('DOUBLE') ||
    t.includes('FLOAT') ||
    t.includes('DECIMAL') ||
    t.includes('NUMERIC') ||
    t.includes('REAL') ||
    t.includes('HUGEINT')
  ) {
    return 'number'
  }
  if (t.includes('BOOL')) return 'checkbox'
  if (t.includes('DATE') || t.includes('TIME') || t.includes('TIMESTAMP')) return 'date'
  if (t.includes('VARCHAR') && t.length > 40) return 'long-text'
  return 'short-text'
}

function cellConfig(variant: CellOpts['variant']): CellOpts {
  switch (variant) {
    case 'number':
      return { variant: 'number' }
    case 'checkbox':
      return { variant: 'checkbox' }
    case 'date':
      return { variant: 'date' }
    case 'long-text':
      return { variant: 'long-text' }
    case 'url':
      return { variant: 'url' }
    default:
      return { variant: 'short-text' }
  }
}

function normalizeCellValue(value: unknown, variant: CellOpts['variant']): unknown {
  if (value == null) {
    if (variant === 'checkbox') return false
    if (variant === 'number') return null
    return ''
  }
  if (variant === 'checkbox') {
    if (typeof value === 'boolean') return value
    const s = String(value).toLowerCase()
    return s === 'true' || s === '1' || s === 't' || s === 'yes'
  }
  if (variant === 'number') {
    if (typeof value === 'number') return value
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return value
}

/** Stable column id from a SQL column name (avoid collisions with reserved keys). */
export function columnIdFor(name: string, index: number): string {
  const cleaned = name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || `col_${index}`
  if (name === '__rowId' || cleaned === 'select' || cleaned === 'add-column') {
    return `col_${index}_${name === '__rowId' ? '__rowId' : cleaned}`
  }
  return cleaned
}

export function queryResultToGrid(result: TablesQueryResult): {
  rows: TablesGridRow[]
  columns: ColumnDef<TablesGridRow>[]
  defaultColumnId: string
} {
  const names = result.columns ?? []
  const types = result.column_types ?? []
  const dataRows = result.rows ?? []

  const colIds = names.map((name, i) => columnIdFor(name, i))
  const variants = types.map((t) => variantForSqlType(t))

  const selectCol = getDataGridSelectColumn<TablesGridRow>({
    enableRowMarkers: true,
    readOnly: true,
    size: 44,
  })

  const dataCols: ColumnDef<TablesGridRow>[] = names.map((name, i) => {
    const id = colIds[i]!
    const variant = variants[i] ?? 'short-text'
    return {
      id,
      accessorKey: id,
      header: name,
      size: variant === 'long-text' ? 280 : 160,
      minSize: 80,
      filterFn,
      meta: {
        label: name,
        cell: cellConfig(variant),
      },
    }
  })

  const rows: TablesGridRow[] = dataRows.map((cells, rowIndex) => {
    const row: TablesGridRow = { __rowId: `r${rowIndex}` }
    for (let i = 0; i < colIds.length; i++) {
      const id = colIds[i]!
      const variant = variants[i] ?? 'short-text'
      row[id] = normalizeCellValue(cells[i], variant)
    }
    return row
  })

  return {
    rows,
    columns: [selectCol, ...dataCols],
    defaultColumnId: colIds[0] ?? 'select',
  }
}

export function formatSourceSubtitle(source: TablesSource): string {
  const parts = [source.type]
  if (source.format) parts.push(source.format)
  parts.push(source.access)
  return parts.join(' · ')
}
