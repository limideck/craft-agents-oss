import { atom } from 'jotai'
import type { TablesQueryResult, TablesSource, TablesTableInfo } from './types'

export const tablesSourcesAtom = atom<TablesSource[]>([])

export const tablesSelectedSourceIdAtom = atom<string | null>(null)

export const tablesTableListAtom = atom<TablesTableInfo[]>([])

export const tablesSelectedTableFqnAtom = atom<string | null>(null)

export const tablesPreviewAtom = atom<TablesQueryResult | null>(null)

export const tablesSidecarReadyAtom = atom(false)

export const tablesLoadingAtom = atom(true)

export const tablesPreviewLoadingAtom = atom(false)

export const tablesErrorAtom = atom<string | null>(null)

export const tablesPreviewErrorAtom = atom<string | null>(null)

export function selectedSource(sources: TablesSource[], id: string | null): TablesSource | null {
  if (!id) return null
  return sources.find((s) => s.id === id) ?? null
}

export function selectedTable(
  tables: TablesTableInfo[],
  fqn: string | null,
): TablesTableInfo | null {
  if (!fqn) return null
  return tables.find((t) => t.fqn === fqn) ?? null
}
