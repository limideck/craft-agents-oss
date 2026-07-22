import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { ShikiDiffViewer } from '@/components/shiki'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { Spinner } from '@grose-agent/ui'

type ChangeEntry = { status: string; path: string }

/**
 * Shared Changes panel — shows git working-tree changes for a workspace
 * directory and renders a side-by-side diff for the selected file.
 * Reused by the Agents and Sites modules (they pass their workspace root).
 */
export function ChangesPanel({ cwd }: { cwd: string | null }) {
  const { t } = useTranslation()
  const [changes, setChanges] = useState<ChangeEntry[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [contents, setContents] = useState<{ original: string | null; modified: string | null } | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  const refresh = useCallback(async () => {
    if (!cwd) {
      setChanges([])
      return
    }
    try {
      const result = await window.electronAPI.getGitStatus(cwd)
      setChanges(result)
      setSelected((prev) => (prev && result.some((c) => c.path === prev) ? prev : (result[0]?.path ?? null)))
    } catch {
      setChanges([])
    }
  }, [cwd])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    if (!cwd || !selected) {
      setContents(null)
      return
    }
    setLoadingDiff(true)
    window.electronAPI
      .getGitFileContents(cwd, selected)
      .then((res) => {
        if (!cancelled) setContents(res)
      })
      .finally(() => {
        if (!cancelled) setLoadingDiff(false)
      })
    return () => {
      cancelled = true
    }
  }, [cwd, selected])

  const fileList = useMemo(() => changes ?? [], [changes])

  return (
    <PanelRoot className="flex flex-col h-full">
      <PanelHeaderBarSplit
        left={<span className="text-xs font-medium">{t('workbench.changes.title', 'Changes')}</span>}
        right={
          <button
            type="button"
            onClick={() => void refresh()}
            className="p-1 rounded hover:bg-muted"
            aria-label={t('workbench.changes.refresh', 'Refresh')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        }
      />
      <PanelBody className="flex min-h-0 flex-1">
        {!cwd ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('workbench.changes.noWorkspace', 'No workspace selected')}
          </div>
        ) : changes === null ? (
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        ) : fileList.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('workbench.changes.clean', 'No uncommitted changes')}
          </div>
        ) : (
          <div className="flex h-full min-h-0">
            <div className="w-56 shrink-0 overflow-auto border-r">
              {fileList.map((c) => (
                <button
                  key={c.path}
                  type="button"
                  onClick={() => setSelected(c.path)}
                  className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-muted ${
                    selected === c.path ? 'bg-muted' : ''
                  }`}
                >
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{c.status}</span>
                  <span className="truncate" title={c.path}>
                    {c.path}
                  </span>
                </button>
              ))}
            </div>
            <div className="min-w-0 flex-1 overflow-auto">
              {loadingDiff ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner />
                </div>
              ) : contents && contents.original !== null && contents.modified !== null ? (
                <ShikiDiffViewer
                  original={contents.original}
                  modified={contents.modified}
                  filePath={selected ?? undefined}
                  diffStyle="split"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  {t('workbench.changes.unavailable', 'Diff unavailable (untracked or binary file)')}
                </div>
              )}
            </div>
          </div>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
