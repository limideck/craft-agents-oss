import { useCallback, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { activeModuleIdAtom } from '../../store/workbench-store'
import {
  ensureTablesReady,
  listSources,
  listTables,
  previewRows,
} from './api'
import {
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
} from './store'

let refreshSeq = 0
let previewSeq = 0
let sharedRefresh: (() => Promise<void>) | null = null

/** Imperative refresh used by upload / delete / restart. */
export function refreshTablesData(): Promise<void> {
  return sharedRefresh?.() ?? Promise.resolve()
}

type Options = {
  /** Only one surface should bootstrap (activity list). */
  bootstrap?: boolean
}

/**
 * Load sources on mount; when selection changes, load tables + row preview.
 */
export function useTablesWorkspaceData(options: Options = {}) {
  const bootstrap = options.bootstrap ?? false
  const activeModuleId = useAtomValue(activeModuleIdAtom)
  const selectedSourceId = useAtomValue(tablesSelectedSourceIdAtom)
  const selectedTableFqn = useAtomValue(tablesSelectedTableFqnAtom)

  const setSources = useSetAtom(tablesSourcesAtom)
  const setSelectedSourceId = useSetAtom(tablesSelectedSourceIdAtom)
  const setTableList = useSetAtom(tablesTableListAtom)
  const setSelectedTableFqn = useSetAtom(tablesSelectedTableFqnAtom)
  const setPreview = useSetAtom(tablesPreviewAtom)
  const setSidecarReady = useSetAtom(tablesSidecarReadyAtom)
  const setLoading = useSetAtom(tablesLoadingAtom)
  const setPreviewLoading = useSetAtom(tablesPreviewLoadingAtom)
  const setError = useSetAtom(tablesErrorAtom)
  const setPreviewError = useSetAtom(tablesPreviewErrorAtom)

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq
    setLoading(true)
    setError(null)

    const ready = await ensureTablesReady()
    if (seq !== refreshSeq) return
    setSidecarReady(ready.ready)

    if (!ready.ready) {
      setSources([])
      setTableList([])
      setPreview(null)
      setError(ready.error ?? 'Tables sidecar is not ready')
      setLoading(false)
      return
    }

    try {
      const sources = await listSources()
      if (seq !== refreshSeq) return
      setSources(sources)
      setSelectedSourceId((prev) => {
        if (prev && sources.some((s) => s.id === prev)) return prev
        return sources[0]?.id ?? null
      })
    } catch (err) {
      if (seq !== refreshSeq) return
      setError(err instanceof Error ? err.message : String(err))
      setSources([])
    } finally {
      if (seq === refreshSeq) setLoading(false)
    }
  }, [
    setSources,
    setSelectedSourceId,
    setTableList,
    setPreview,
    setSidecarReady,
    setLoading,
    setError,
  ])

  useEffect(() => {
    sharedRefresh = refresh
    return () => {
      if (sharedRefresh === refresh) sharedRefresh = null
    }
  }, [refresh])

  useEffect(() => {
    if (!bootstrap) return
    void refresh()
  }, [bootstrap, refresh])

  useEffect(() => {
    if (!bootstrap || activeModuleId !== 'tables') return
    void refresh()
  }, [bootstrap, activeModuleId, refresh])

  // When source selection changes, load its tables.
  useEffect(() => {
    if (!bootstrap || !selectedSourceId) {
      setTableList([])
      setSelectedTableFqn(null)
      setPreview(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const tables = await listTables(selectedSourceId)
        if (cancelled) return
        setTableList(tables)
        setSelectedTableFqn((prev) => {
          if (prev && tables.some((t) => t.fqn === prev)) return prev
          return tables[0]?.fqn ?? null
        })
        setPreviewError(null)
      } catch (err) {
        if (cancelled) return
        setTableList([])
        setSelectedTableFqn(null)
        setPreview(null)
        setPreviewError(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    bootstrap,
    selectedSourceId,
    setTableList,
    setSelectedTableFqn,
    setPreview,
    setPreviewError,
  ])

  // When table selection changes, load preview rows.
  useEffect(() => {
    if (!bootstrap || !selectedSourceId || !selectedTableFqn) {
      setPreview(null)
      return
    }

    const tableList = selectedTableFqn
    // Resolve name + schema from fqn: catalog.schema.table
    const parts = tableList.split('.')
    const schema = parts.length >= 3 ? parts[1]! : 'default'
    const tableName = parts.length >= 3 ? parts[2]! : parts[parts.length - 1]!

    const seq = ++previewSeq
    setPreviewLoading(true)
    setPreviewError(null)

    void (async () => {
      try {
        const result = await previewRows(selectedSourceId, tableName, { schema, limit: 100 })
        if (seq !== previewSeq) return
        setPreview(result)
      } catch (err) {
        if (seq !== previewSeq) return
        setPreview(null)
        setPreviewError(err instanceof Error ? err.message : String(err))
      } finally {
        if (seq === previewSeq) setPreviewLoading(false)
      }
    })()
  }, [
    bootstrap,
    selectedSourceId,
    selectedTableFqn,
    setPreview,
    setPreviewLoading,
    setPreviewError,
  ])

  return { refresh }
}
