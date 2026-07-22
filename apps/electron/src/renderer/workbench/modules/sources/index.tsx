import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DatabaseZap, Plus } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { SourcesListPanel } from '@/components/lists/SourcesListPanel'
import SourceInfoPage from '@/pages/SourceInfoPage'
import { useAppShellContext, useActiveWorkspace } from '@/context/AppShellContext'
import { sourcesAtom } from '@/atoms/sources'
import { Button } from '@/components/ui/button'
import { EditPopover, getEditConfig, type EditContextKey } from '@/components/ui/EditPopover'
import { cn } from '@/lib/utils'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../dock/panel-primitives'
import { ActivityShell } from '../../shell/ActivityShell'
import { selectedSourceSlugAtom, sourceFilterAtom } from '../stock-store'
import type { LoadedSource, SourceFilter } from '../../../../shared/types'

const FILTERS: Array<{ id: string; label: string; filter: SourceFilter | null }> = [
  { id: 'all', label: 'All', filter: null },
  { id: 'api', label: 'API', filter: { kind: 'type', sourceType: 'api' } },
  { id: 'mcp', label: 'MCP', filter: { kind: 'type', sourceType: 'mcp' } },
  { id: 'local', label: 'Local', filter: { kind: 'type', sourceType: 'local' } },
]

function SourcesActivityView() {
  const { t } = useTranslation()
  const sources = useAtomValue(sourcesAtom)
  const sourceFilter = useAtomValue(sourceFilterAtom)
  const setSourceFilter = useSetAtom(sourceFilterAtom)
  const selectedSlug = useAtomValue(selectedSourceSlugAtom)
  const setSelectedSlug = useSetAtom(selectedSourceSlugAtom)
  const { activeWorkspaceId } = useAppShellContext()
  const activeWorkspace = useActiveWorkspace()
  const [localMcpEnabled, setLocalMcpEnabled] = React.useState(true)

  React.useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI
      .getWorkspaceSettings(activeWorkspaceId)
      .then((settings) => {
        if (settings) setLocalMcpEnabled(settings.localMcpEnabled ?? true)
      })
      .catch(() => {})
  }, [activeWorkspaceId])

  const handleDelete = React.useCallback(
    async (sourceSlug: string) => {
      if (!activeWorkspaceId) return
      try {
        await window.electronAPI.deleteSource(activeWorkspaceId, sourceSlug)
        if (selectedSlug === sourceSlug) setSelectedSlug(null)
        toast.success(t('toast.deletedSource'))
      } catch (err) {
        console.error('[Sources] Failed to delete source:', err)
        toast.error(t('toast.failedToDeleteSource'))
      }
    },
    [activeWorkspaceId, selectedSlug, setSelectedSlug, t],
  )

  const handleClick = React.useCallback(
    (source: LoadedSource) => {
      setSelectedSlug(source.config.slug)
    },
    [setSelectedSlug],
  )

  const addSourceContextKey: EditContextKey =
    sourceFilter?.kind === 'type'
      ? (`add-source-${sourceFilter.sourceType}` as EditContextKey)
      : 'add-source'

  return (
    <ActivityShell
      title={t('sidebar.sources')}
      scroll={false}
      bodyClassName="overflow-hidden"
      actions={
        activeWorkspace?.rootPath ? (
          <EditPopover
            align="end"
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={t('sourcesList.addSource')}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
            {...getEditConfig(addSourceContextKey, activeWorkspace.rootPath)}
          />
        ) : undefined
      }
      toolbar={
        <div className="px-2 py-1.5 flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const active =
              (f.filter === null && sourceFilter === null) ||
              (f.filter?.kind === 'type' &&
                sourceFilter?.kind === 'type' &&
                f.filter.sourceType === sourceFilter.sourceType)
            return (
              <button
                key={f.id}
                type="button"
                className={cn(
                  'px-2 py-0.5 text-[11px] rounded-md',
                  active
                    ? 'bg-foreground-10 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground-5',
                )}
                onClick={() => setSourceFilter(f.filter)}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      }
    >
      <SourcesListPanel
        sources={sources}
        sourceFilter={sourceFilter}
        workspaceRootPath={activeWorkspace?.rootPath}
        onDeleteSource={handleDelete}
        onSourceClick={handleClick}
        selectedSourceSlug={selectedSlug}
        localMcpEnabled={localMcpEnabled}
        className="h-full"
      />
    </ActivityShell>
  )
}

function SourceDetailPanel() {
  const selectedSlug = useAtomValue(selectedSourceSlugAtom)
  const setSelectedSlug = useSetAtom(selectedSourceSlugAtom)
  const { activeWorkspaceId } = useAppShellContext()

  if (!selectedSlug || !activeWorkspaceId) {
    return (
      <PanelRoot>
        <PanelHeaderBar>
          <span className="font-medium truncate">Source</span>
        </PanelHeaderBar>
        <PanelBody className="flex items-center justify-center text-muted-foreground text-sm">
          Select a source from the list.
        </PanelBody>
      </PanelRoot>
    )
  }

  return (
    <PanelRoot>
      <PanelBody padding={false} scroll className="flex flex-col">
        <SourceInfoPage
          sourceSlug={selectedSlug}
          workspaceId={activeWorkspaceId}
          onDelete={() => setSelectedSlug(null)}
        />
      </PanelBody>
    </PanelRoot>
  )
}

export const sourcesModule: WorkbenchModule = {
  id: 'sources',
  title: 'Sources',
  icon: <DatabaseZap className="h-4 w-4" />,
  order: 91,
  placement: 'footer',
  defaultLayout: {
    columns: [
      {
        id: 'center',
        width: 1,
        groups: [{ id: 'group-source-detail', panels: [{ id: 'source-detail', component: 'source-detail', title: 'Source' }] }],
      },
    ],
  },
  panels: [
    {
      component: 'source-detail',
      title: 'Source',
      singleton: true,
      render: () => <SourceDetailPanel />,
    },
  ],
  activityView: SourcesActivityView,
}
