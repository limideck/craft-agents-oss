import { useAtom, useAtomValue } from 'jotai'
import { Plus, RefreshCw, Table2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { deleteSource, pickAndUploadSource } from '../api'
import {
  tablesErrorAtom,
  tablesLoadingAtom,
  tablesSelectedSourceIdAtom,
  tablesSidecarReadyAtom,
  tablesSourcesAtom,
} from '../store'
import { formatSourceSubtitle } from '../utils'
import { refreshTablesData, useTablesWorkspaceData } from '../use-tables-data'

function SourceListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5 animate-pulse">
          <div className="h-3.5 rounded bg-foreground-10 w-[75%]" />
          <div className="h-2.5 rounded bg-foreground-5 w-[45%]" />
        </div>
      ))}
    </div>
  )
}

/**
 * ActivityBar side rail — data source list (upload + select + delete).
 */
export function SourceListView() {
  const { refresh } = useTablesWorkspaceData({ bootstrap: true })
  const [sources, setSources] = useAtom(tablesSourcesAtom)
  const [selectedId, setSelectedId] = useAtom(tablesSelectedSourceIdAtom)
  const loading = useAtomValue(tablesLoadingAtom)
  const error = useAtomValue(tablesErrorAtom)
  const ready = useAtomValue(tablesSidecarReadyAtom)

  const upload = async () => {
    try {
      const source = await pickAndUploadSource()
      if (!source) return
      setSources((prev) => [source, ...prev.filter((s) => s.id !== source.id)])
      setSelectedId(source.id)
      toast.success(`Added ${source.name}`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteSource(id)
      setSources((prev) => {
        const next = prev.filter((s) => s.id !== id)
        if (selectedId === id) setSelectedId(next[0]?.id ?? null)
        return next
      })
      toast.success('Source removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      await refresh()
    }
  }

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between">
        <span className="font-medium truncate">Sources</span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Refresh"
            onClick={() => void refreshTablesData()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Upload CSV, JSON, Parquet, SQLite, or DuckDB"
            disabled={!ready}
            onClick={() => void upload()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PanelHeaderBar>
      <PanelBody padding={false} className="p-0">
        {loading && sources.length === 0 ? (
          <SourceListSkeleton />
        ) : error && sources.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground space-y-2">
            <p className="text-destructive/90">{error}</p>
            <p className="text-xs leading-relaxed">
              Run <code className="rounded bg-muted px-1">bun run setup:tables</code> then restart,
              or set <code className="rounded bg-muted px-1">GROSE_TABLES_URL</code>.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void refresh()}
            >
              Retry
            </Button>
          </div>
        ) : sources.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground space-y-2">
            <p>No data sources yet.</p>
            <p className="text-xs leading-relaxed">
              Upload a CSV, JSON, Parquet, SQLite, or DuckDB file. Agents query them via the Tables
              MCP source.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={!ready}
              onClick={() => void upload()}
            >
              <Plus className="mr-1 h-3 w-3" />
              Upload file
            </Button>
          </div>
        ) : (
          <ul className="py-1">
            {sources.map((source) => {
              const active = source.id === selectedId
              return (
                <li key={source.id} className="group relative">
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 pr-9 text-left text-sm rounded-none',
                      'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
                      active && 'bg-foreground-10 text-foreground',
                      !active && 'text-foreground/90',
                    )}
                    onClick={() => setSelectedId(source.id)}
                  >
                    <Table2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium leading-tight">{source.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {formatSourceSubtitle(source)}
                      </span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute end-1 top-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    title={`Remove ${source.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      void remove(source.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
