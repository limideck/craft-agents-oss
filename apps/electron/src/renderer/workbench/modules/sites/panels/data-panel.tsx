import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Database, Loader2, Plus, RefreshCw, Table2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DataGridContainer,
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from '@grose-agent/datagrid'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ensureTablesReady } from '../../tables/api'
import { queryResultToGrid } from '../../tables/utils'
import type { TablesQueryResult, TablesSource, TablesTableInfo } from '../../tables/types'
import { selectedSiteAtom } from '../store'
import {
  listSiteSources,
  listSiteTables,
  pickAndUploadSiteSource,
  previewSiteRows,
} from '../site-data-api'

type FlatTable = {
  key: string
  sourceId: string
  sourceName: string
  table: TablesTableInfo
}

/**
 * Site Data — same Tables (plydb) sidecar as the Tables module, scoped to
 * sources registered under id `site-{siteId}-*`.
 */
export function SitesDataPanel() {
  const { t } = useTranslation()
  const site = useAtomValue(selectedSiteAtom)

  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<TablesSource[]>([])
  const [flatTables, setFlatTables] = useState<FlatTable[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<TablesQueryResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const selected = useMemo(
    () => flatTables.find((t) => t.key === selectedKey) ?? null,
    [flatTables, selectedKey],
  )

  const grid = useMemo(() => {
    if (!preview?.success) return null
    return queryResultToGrid(preview)
  }, [preview])

  const refresh = useCallback(async () => {
    if (!site) {
      setSources([])
      setFlatTables([])
      setSelectedKey(null)
      setPreview(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const status = await ensureTablesReady()
    setReady(status.ready)
    if (!status.ready) {
      setSources([])
      setFlatTables([])
      setError(status.error ?? 'Tables sidecar is not ready')
      setLoading(false)
      return
    }

    try {
      const siteSources = await listSiteSources(site.id)
      setSources(siteSources)

      const next: FlatTable[] = []
      for (const source of siteSources) {
        try {
          const tables = await listSiteTables(source.id)
          for (const table of tables) {
            next.push({
              key: `${source.id}::${table.fqn}`,
              sourceId: source.id,
              sourceName: source.name,
              table,
            })
          }
        } catch {
          // Skip sources that fail table discovery.
        }
      }
      setFlatTables(next)
      setSelectedKey((prev) => {
        if (prev && next.some((t) => t.key === prev)) return prev
        return next[0]?.key ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSources([])
      setFlatTables([])
    } finally {
      setLoading(false)
    }
  }, [site])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!selected) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    const parts = selected.table.fqn.split('.')
    const schema = parts.length >= 3 ? parts[1]! : selected.table.schema || 'default'
    const tableName = parts.length >= 3 ? parts[2]! : selected.table.name

    void previewSiteRows(selected.sourceId, tableName, { schema, limit: 100 })
      .then((result) => {
        if (!cancelled) setPreview(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null)
          setPreviewError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected])

  const upload = async () => {
    if (!site) return
    try {
      const source = await pickAndUploadSiteSource(site.id)
      if (!source) return
      toast.success(t('workbench.sites.dataUploaded', { defaultValue: `Added ${source.name}` }))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  if (!site) {
    return (
      <PanelRoot>
        <PanelBody className="flex items-center justify-center text-sm text-muted-foreground">
          {t('workbench.sites.selectSite')}
        </PanelBody>
      </PanelRoot>
    )
  }

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-xs">{t('workbench.sites.data')}</span>
          {sources.length > 0 ? (
            <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
              {sources.length} src · {flatTables.length} tbl
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={t('common.refresh', { defaultValue: 'Refresh' })}
            onClick={() => void refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={t('workbench.sites.dataUpload', {
              defaultValue: 'Upload CSV, JSON, Parquet, SQLite, or DuckDB',
            })}
            disabled={!ready}
            onClick={() => void upload()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PanelHeaderBar>

      <PanelBody padding={false} scroll={false} className="flex min-h-0 flex-1 flex-col">
        {!ready || error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <Table2 className="h-7 w-7 opacity-40" />
            <p>{error ?? t('workbench.sites.dataSidecar', { defaultValue: 'Starting Tables sidecar…' })}</p>
            <p className="max-w-sm text-xs leading-relaxed opacity-80">
              {t('workbench.sites.dataSidecarHint', {
                defaultValue: 'Run bun run setup:tables if the binary is missing.',
              })}
            </p>
          </div>
        ) : loading && flatTables.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.loading')}
          </div>
        ) : flatTables.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
            <Table2 className="h-7 w-7 opacity-40" />
            <p>{t('workbench.sites.dataEmpty', { defaultValue: 'No data sources for this site yet.' })}</p>
            <p className="max-w-sm text-xs leading-relaxed opacity-80">
              {t('workbench.sites.dataEmptyHint', {
                defaultValue:
                  'Upload a CSV / SQLite / DuckDB file. Sources are registered in Tables with id site-{siteId}-*.',
              })}
            </p>
            <Button type="button" size="sm" disabled={!ready} onClick={() => void upload()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t('workbench.sites.dataUploadShort', { defaultValue: 'Add data' })}
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="w-[160px] shrink-0 overflow-auto border-r border-border/80">
              {flatTables.map((item) => {
                const active = item.key === selectedKey
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left text-xs hover:bg-muted/60',
                      active && 'bg-muted',
                    )}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    <span className="w-full truncate font-medium">{item.table.name}</span>
                    <span className="w-full truncate text-[10px] text-muted-foreground">
                      {item.sourceName}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {previewError && !grid ? (
                <div className="p-4 text-sm text-destructive/90">{previewError}</div>
              ) : previewLoading && !grid ? (
                <div className="flex min-h-0 flex-1 flex-col p-2">
                  <DataGridSkeleton className="h-full min-h-[200px]">
                    <DataGridSkeletonToolbar />
                    <DataGridSkeletonGrid />
                  </DataGridSkeleton>
                </div>
              ) : grid && grid.rows.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                  {t('workbench.sites.dataNoRows', { defaultValue: 'This table has no rows.' })}
                </div>
              ) : grid ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <DataGridContainer
                    key={selectedKey ?? 'grid'}
                    initialData={grid.rows}
                    initialColumns={grid.columns}
                    getRowId={(row) => row.__rowId}
                    createNewRow={() => ({ __rowId: crypto.randomUUID() })}
                    createNewRows={(n) =>
                      Array.from({ length: n }, () => ({ __rowId: crypto.randomUUID() }))
                    }
                    pinnedColumns={['select']}
                    defaultColumnId={grid.defaultColumnId}
                    readOnly
                    enablePaste={false}
                    stretchColumns
                    heightOffset={120}
                    className="flex min-h-0 flex-1 flex-col"
                    toolbarClassName="flex items-center gap-2 justify-end px-2 py-1.5 border-b border-border/60"
                  />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  {t('workbench.sites.dataSelectTable', { defaultValue: 'Select a table' })}
                </div>
              )}
            </div>
          </div>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
