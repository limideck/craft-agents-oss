import type { ColumnDef } from '@tanstack/react-table'
import * as React from 'react'
import { DataGrid } from './data-grid'
import { getDataGridAddColumn } from './data-grid-add-column'
import { DataGridFilterMenu } from './data-grid-filter-menu'
import { DataGridKeyboardShortcuts } from './data-grid-keyboard-shortcuts'
import { DataGridRowHeightMenu } from './data-grid-row-height-menu'
import { DataGridSortMenu } from './data-grid-sort-menu'
import { DataGridViewMenu } from './data-grid-view-menu'
import { useDataGrid } from '../../hooks/use-data-grid'
import { useWindowSize } from '../../hooks/use-window-size'
import type { CellOpts, CellSelectOption, FileCellData } from '../../lib/data-grid-types'
import { getCellKey } from '../../lib/data-grid'
import { useDataGridStore } from '../../stores/data-grid-store'

/** Creates a CellOpts config for a given variant */
function createCellConfig(variant: CellOpts['variant']): CellOpts {
  switch (variant) {
    case 'select':
      return { variant: 'select', options: [] }
    case 'multi-select':
      return { variant: 'multi-select', options: [] }
    case 'number':
      return { variant: 'number' }
    case 'file':
      return { variant: 'file' }
    case 'long-text':
      return { variant: 'long-text' }
    case 'checkbox':
      return { variant: 'checkbox' }
    case 'date':
      return { variant: 'date' }
    case 'url':
      return { variant: 'url' }
    case 'short-text':
    default:
      return { variant: 'short-text' }
  }
}

export interface DataGridContainerProps<T> {
  initialData: T[]
  initialColumns: ColumnDef<T>[]
  getRowId: (row: T, index: number) => string
  createNewRow: () => T
  createNewRows: (count: number) => T[]
  pinnedColumns?: string[]
  defaultColumnId: string
  /** Fixed grid height; defaults to window height minus chrome. */
  height?: number
  /** Extra chrome offset when auto-sizing from window height. */
  heightOffset?: number
  readOnly?: boolean
  enableSearch?: boolean
  enablePaste?: boolean
  stretchColumns?: boolean
  className?: string
  toolbarClassName?: string
  /** Hide the filter/sort/view toolbar. */
  hideToolbar?: boolean
  onFilesUpload?: (params: {
    files: File[]
    rowIndex: number
    columnId: string
  }) => Promise<FileCellData[]>
  onEnrichColumn?: (columnId: string, prompt: string) => void
  /** Slot below the grid (e.g. AI chat or custom panels). */
  children?: React.ReactNode
}

export function DataGridContainer<T>({
  initialData,
  initialColumns,
  getRowId,
  createNewRow,
  createNewRows,
  pinnedColumns = [],
  defaultColumnId,
  height: heightProp,
  heightOffset = 48,
  readOnly = false,
  enableSearch = true,
  enablePaste = true,
  stretchColumns = false,
  className,
  toolbarClassName,
  hideToolbar = false,
  onFilesUpload,
  onEnrichColumn: onEnrichColumnProp,
  children,
}: DataGridContainerProps<T>) {
  const windowSize = useWindowSize({ defaultHeight: 760 })
  const [data, setData] = React.useState<T[]>(initialData)
  const [columns, setColumns] = React.useState<ColumnDef<T>[]>(initialColumns)

  // Sync when the host remounts with a new dataset (e.g. table picker change).
  // Callers that pass fresh array literals every render should memoize or remount via `key`.
  React.useEffect(() => {
    setData(initialData)
  }, [initialData])

  React.useEffect(() => {
    setColumns(initialColumns)
  }, [initialColumns])

  const onColumnUpdate = React.useCallback(
    (
      columnId: string,
      updates: Partial<{
        label: string
        variant: CellOpts['variant']
        prompt: string
        options: CellSelectOption[]
      }>,
    ) => {
      setColumns((prev) =>
        prev.map((col): ColumnDef<T> => {
          if (col.id !== columnId) return col

          const currentMeta = col.meta ?? {}
          const currentCell = currentMeta.cell ?? { variant: 'short-text' as const }

          let newCell: CellOpts =
            updates.variant && updates.variant !== currentCell.variant
              ? createCellConfig(updates.variant)
              : currentCell

          if (updates.options !== undefined) {
            const cellVariant = newCell.variant
            if (cellVariant === 'select' || cellVariant === 'multi-select') {
              newCell = {
                ...newCell,
                options: updates.options,
              } as CellOpts
            }
          }

          return {
            ...col,
            header: updates.label ?? col.header,
            meta: {
              ...currentMeta,
              label: updates.label ?? currentMeta.label,
              cell: newCell,
              prompt: updates.prompt ?? currentMeta.prompt,
            },
          } as ColumnDef<T>
        }),
      )
    },
    [],
  )

  const onColumnDelete = React.useCallback((columnId: string) => {
    setColumns((prev) => prev.filter((col) => col.id !== columnId))
  }, [])

  const onColumnAdd = React.useCallback(
    (addConfig: {
      label: string
      variant: CellOpts['variant']
      prompt: string
      options?: CellSelectOption[]
      insertAfterColumnId?: string
    }) => {
      const newId = `column_${Date.now()}`

      let cellConfig = createCellConfig(addConfig.variant)
      if (
        addConfig.options &&
        (addConfig.variant === 'select' || addConfig.variant === 'multi-select')
      ) {
        cellConfig = { ...cellConfig, options: addConfig.options } as CellOpts
      }

      const newColumn: ColumnDef<T> = {
        id: newId,
        accessorKey: newId,
        header: addConfig.label,
        meta: {
          label: addConfig.label,
          cell: cellConfig,
          prompt: addConfig.prompt || undefined,
        },
      }

      setColumns((prev) => {
        if (!addConfig.insertAfterColumnId) return [...prev, newColumn]
        const idx = prev.findIndex((col) => col.id === addConfig.insertAfterColumnId)
        if (idx === -1) return [...prev, newColumn]
        const result = [...prev]
        result.splice(idx + 1, 0, newColumn)
        return result
      })

      setData((prev) =>
        prev.map((row) => ({
          ...row,
          [newId]: '',
        })),
      )
    },
    [],
  )

  const setSelectionState = useDataGridStore((state) => state.setSelectionState)

  const onEnrichColumn = React.useCallback(
    (columnId: string, prompt: string) => {
      onColumnUpdate(columnId, { prompt })
      const selectedCells = new Set(data.map((_, rowIndex) => getCellKey(rowIndex, columnId)))
      setSelectionState({
        selectedCells,
        selectionRange: null,
        isSelecting: false,
      })
      onEnrichColumnProp?.(columnId, prompt)
    },
    [data, onColumnUpdate, onEnrichColumnProp, setSelectionState],
  )

  const effectiveColumns = React.useMemo(
    () => (readOnly ? columns : [...columns, getDataGridAddColumn<T>()]),
    [columns, readOnly],
  )

  const { table, tableMeta, hasSelection, ...dataGridProps } = useDataGrid<T>({
    data,
    onDataChange: setData,
    columns: effectiveColumns,
    getRowId,
    readOnly,
    onRowAdd: readOnly
      ? undefined
      : () => {
          setData((prev) => [...prev, createNewRow()])
          return { rowIndex: data.length, columnId: defaultColumnId }
        },
    onRowsAdd: readOnly
      ? undefined
      : (count) => {
          setData((prev) => [...prev, ...createNewRows(count)])
        },
    onRowsDelete: readOnly
      ? undefined
      : (rows) => {
          setData((prev) => prev.filter((row) => !rows.includes(row)))
        },
    onFilesUpload:
      onFilesUpload ??
      (async ({ files }) => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return files.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
        }))
      }),
    onColumnUpdate: readOnly ? undefined : onColumnUpdate,
    onColumnDelete: readOnly ? undefined : onColumnDelete,
    onColumnAdd: readOnly ? undefined : onColumnAdd,
    onEnrichColumn: readOnly ? undefined : onEnrichColumn,
    initialState: {
      columnPinning: {
        left: pinnedColumns,
        right: readOnly ? [] : ['add-column'],
      },
    },
    enableSearch,
    enablePaste: enablePaste && !readOnly,
  })

  const height = heightProp ?? Math.max(320, windowSize.height - heightOffset)

  return (
    <div className={className}>
      {!hideToolbar && (
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className={
            toolbarClassName ??
            'flex items-center gap-2 justify-end p-2'
          }
        >
          <DataGridFilterMenu table={table} align="end" />
          <DataGridSortMenu table={table} align="end" />
          <DataGridRowHeightMenu table={table} align="end" />
          <DataGridViewMenu table={table} align="end" />
        </div>
      )}
      <DataGrid
        {...dataGridProps}
        table={table}
        tableMeta={tableMeta}
        hasSelection={hasSelection}
        height={height}
        stretchColumns={stretchColumns}
      />
      <DataGridKeyboardShortcuts enableSearch={!!dataGridProps.searchState} />
      {children}
    </div>
  )
}
