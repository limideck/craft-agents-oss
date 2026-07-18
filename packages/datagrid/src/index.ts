/**
 * @grose-agent/datagrid — Airtable-like spreadsheet grid
 *
 * Platform-agnostic React components (Electron / web). AI chat from the
 * ai-datagrid template is intentionally excluded; wire your own agent via
 * `children` / column-mapping helpers.
 */

export { DataGrid } from './components/data-grid/data-grid'
export { DataGridContainer, type DataGridContainerProps } from './components/data-grid/data-grid-container'
export { DataGridFilterMenu } from './components/data-grid/data-grid-filter-menu'
export { DataGridSortMenu } from './components/data-grid/data-grid-sort-menu'
export { DataGridViewMenu } from './components/data-grid/data-grid-view-menu'
export { DataGridRowHeightMenu } from './components/data-grid/data-grid-row-height-menu'
export { DataGridKeyboardShortcuts } from './components/data-grid/data-grid-keyboard-shortcuts'
export { DataGridSkeleton, DataGridSkeletonGrid, DataGridSkeletonToolbar } from './components/data-grid/data-grid-skeleton'
export { getDataGridSelectColumn } from './components/data-grid/data-grid-select-column'
export { getDataGridAddColumn } from './components/data-grid/data-grid-add-column'
export { Toaster as DatagridToaster } from './components/ui/sonner'

export { useDataGrid } from './hooks/use-data-grid'
export { useDataGridUndoRedo } from './hooks/use-data-grid-undo-redo'
export { useWindowSize } from './hooks/use-window-size'
export { useDataGridStore } from './stores/data-grid-store'

export {
  getCellKey,
  parseCellKey,
  getRowHeightValue,
  flexRender,
  getColumnBorderVisibility,
  getColumnPinningStyle,
  parseTsv,
} from './lib/data-grid'

export { getFilterFn, getDefaultOperator, getOperatorsForVariant } from './lib/data-grid-filters'

export type {
  Direction,
  RowHeightValue,
  CellSelectOption,
  CellOpts,
  CellUpdate,
  TypedCellValue,
  FileCellData,
  CellPosition,
  SelectionState,
  FilterOperator,
  FilterValue,
  SearchState,
  ContextMenuState,
  PasteDialogState,
} from './lib/data-grid-types'

export { validateCellValue } from './lib/data-grid-types'

export { columnDefinitionToColumnDef } from './lib/column-mapping'
export type { SelectionContext } from './lib/selection-context'
export { buildGridContext } from './lib/grid-context'

export {
  columnDefinitionSchema,
  columnUpdateSchema,
  type ColumnUpdate,
} from './lib/assistant-schemas'
