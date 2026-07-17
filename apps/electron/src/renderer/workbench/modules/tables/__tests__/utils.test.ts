import { describe, expect, it } from 'bun:test'
import { columnIdFor, formatSourceSubtitle, queryResultToGrid } from '../utils'
import type { TablesQueryResult, TablesSource } from '../types'

describe('columnIdFor', () => {
  it('sanitizes special characters', () => {
    expect(columnIdFor('Full Name!', 0)).toBe('Full_Name')
  })

  it('avoids reserved ids', () => {
    expect(columnIdFor('__rowId', 2)).toBe('col_2___rowId')
    expect(columnIdFor('select', 0)).toBe('col_0_select')
  })
})

describe('queryResultToGrid', () => {
  it('maps columns and rows with select column first', () => {
    const result: TablesQueryResult = {
      success: true,
      columns: ['id', 'name'],
      column_types: ['INTEGER', 'VARCHAR'],
      rows: [
        [1, 'Ada'],
        [2, 'Grace'],
      ],
      row_count: 2,
    }
    const grid = queryResultToGrid(result)
    expect(grid.columns[0]?.id).toBe('select')
    expect(grid.columns.map((c) => c.id)).toEqual(['select', 'id', 'name'])
    expect(grid.rows).toHaveLength(2)
    expect(grid.rows[0]).toMatchObject({ __rowId: 'r0', id: 1, name: 'Ada' })
    expect(grid.defaultColumnId).toBe('id')
  })

  it('handles empty result', () => {
    const grid = queryResultToGrid({ success: true, row_count: 0, columns: [], rows: [] })
    expect(grid.rows).toEqual([])
    expect(grid.columns[0]?.id).toBe('select')
  })
})

describe('formatSourceSubtitle', () => {
  it('joins type format access', () => {
    const source: TablesSource = {
      id: 'c',
      type: 'file',
      name: 'Customers',
      format: 'csv',
      access: 'read',
    }
    expect(formatSourceSubtitle(source)).toBe('file · csv · read')
  })
})
