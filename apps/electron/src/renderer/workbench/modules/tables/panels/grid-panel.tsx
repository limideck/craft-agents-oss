import { useMemo } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { ChevronRight, Table2 } from 'lucide-react'
import {
  DataGridContainer,
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from '@grose-agent/datagrid'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { cn } from '@/lib/utils'
import {
  selectedSource,
  selectedTable,
  tablesErrorAtom,
  tablesLoadingAtom,
  tablesPreviewAtom,
  tablesPreviewErrorAtom,
  tablesPreviewLoadingAtom,
  tablesSelectedSourceIdAtom,
  tablesSelectedTableFqnAtom,
  tablesSidecarReadyAtom,
  tablesSourcesAtom,
  tablesTableListAtom,
} from '../store'
import { queryResultToGrid, shouldGridBeReadOnly } from '../utils'
import { useTablesWorkspaceData } from '../use-tables-data'

/**
 * Dock panel — table picker + datagrid preview of sidecar Admin rows.
 */
export function TablesGridPanel() {
  // Activity list bootstraps; this panel only consumes atoms + re-registers refresh.
  useTablesWorkspaceData({ bootstrap: false })

  const sources = useAtomValue(tablesSourcesAtom)
  const selectedSourceId = useAtomValue(tablesSelectedSourceIdAtom)
  const tableList = useAtomValue(tablesTableListAtom)
  const [selectedTableFqn, setSelectedTableFqn] = useAtom(tablesSelectedTableFqnAtom)
  const preview = useAtomValue(tablesPreviewAtom)
  const loading = useAtomValue(tablesLoadingAtom)
  const previewLoading = useAtomValue(tablesPreviewLoadingAtom)
  const error = useAtomValue(tablesErrorAtom)
  const previewError = useAtomValue(tablesPreviewErrorAtom)
  const ready = useAtomValue(tablesSidecarReadyAtom)

  const source = selectedSource(sources, selectedSourceId)
  const table = selectedTable(tableList, selectedTableFqn)
  const readOnly = shouldGridBeReadOnly(source)

  const grid = useMemo(() => {
    if (!preview?.success) return null
    return queryResultToGrid(preview)
  }, [preview])

  const emptyChrome = !source
  const showSkeleton = (loading && !source) || (previewLoading && !grid)

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between gap-2 min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground"
        >
          <span className="shrink-0 text-foreground/80">Tables</span>
          {source ? (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
              <span className="truncate text-foreground font-medium">{source.name}</span>
            </>
          ) : null}
          {table ? (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
              <span className="truncate">{table.name}</span>
            </>
          ) : null}
        </nav>
        {preview?.row_count != null && grid ? (
          <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
            {preview.row_count}
            {preview.truncated ? '+' : ''} rows
            {readOnly ? ' · preview' : ''}
          </span>
        ) : null}
      </PanelHeaderBar>

      {tableList.length > 1 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/80 px-2 py-1.5">
          {tableList.map((t) => {
            const active = t.fqn === selectedTableFqn
            return (
              <button
                key={t.fqn}
                type="button"
                className={cn(
                  'shrink-0 rounded-md px-2 py-1 text-[11px] transition-colors',
                  'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
                  active ? 'bg-foreground-10 text-foreground font-medium' : 'text-muted-foreground',
                )}
                onClick={() => setSelectedTableFqn(t.fqn)}
              >
                {t.name}
              </button>
            )
          })}
        </div>
      ) : null}

      <PanelBody padding={false} scroll={false} className="flex flex-col p-0">
        {!ready && emptyChrome ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Table2 className="h-8 w-8 opacity-40" />
            <p>{error ?? 'Starting Tables sidecar…'}</p>
            <p className="max-w-sm text-xs leading-relaxed opacity-80">
              Run <code className="rounded bg-muted px-1">bun run setup:tables</code> if the binary
              is missing.
            </p>
          </div>
        ) : emptyChrome ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Table2 className="h-8 w-8 opacity-40" />
            <p>Select or upload a data source</p>
            <p className="max-w-sm text-xs leading-relaxed opacity-80">
              Sources appear in the activity list. Agents can query them via the Tables MCP tools.
            </p>
          </div>
        ) : previewError && !grid ? (
          <div className="p-4 text-sm text-destructive/90">{previewError}</div>
        ) : showSkeleton ? (
          <div className="flex min-h-0 flex-1 flex-col p-2">
            <DataGridSkeleton className="h-full min-h-[240px]">
              <DataGridSkeletonToolbar />
              <DataGridSkeletonGrid />
            </DataGridSkeleton>
          </div>
        ) : grid && grid.rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            This table has no rows to preview.
          </div>
        ) : grid ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <DataGridContainer
              key={`${selectedSourceId}:${selectedTableFqn}`}
              initialData={grid.rows}
              initialColumns={grid.columns}
              getRowId={(row) => row.__rowId}
              createNewRow={() => ({ __rowId: crypto.randomUUID() })}
              createNewRows={(n) =>
                Array.from({ length: n }, () => ({ __rowId: crypto.randomUUID() }))
              }
              pinnedColumns={['select']}
              defaultColumnId={grid.defaultColumnId}
              readOnly={readOnly}
              enablePaste={false}
              stretchColumns
              heightOffset={120}
              className="flex min-h-0 flex-1 flex-col"
              toolbarClassName="flex items-center gap-2 justify-end px-2 py-1.5 border-b border-border/60"
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            {tableList.length === 0
              ? 'No tables discovered in this source.'
              : 'Loading preview…'}
          </div>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
