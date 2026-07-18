import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Globe, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ActivityShell } from '../../../shell/ActivityShell'
import {
  selectedSiteIdAtom,
  sitesAtom,
  sitesCreateOpenAtom,
  sitesErrorAtom,
  sitesLoadingAtom,
  sitesPreviewStatusAtom,
  sitesPreviewUrlAtom,
  sitesSelectedFilePathAtom,
} from '../store'
import { refreshSitesData, useSitesWorkspaceData, upsertSiteInList } from '../use-sites-data'
import { CreateSiteDialog } from '../components/create-site-dialog'

function SitesListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5 animate-pulse">
          <div className="h-3.5 rounded bg-foreground-10 w-[80%]" />
          <div className="h-2.5 rounded bg-foreground-5 w-[50%]" />
        </div>
      ))}
    </div>
  )
}

/**
 * ActivityBar side rail — site list + New Site.
 */
export function SitesListView() {
  const { t } = useTranslation()
  const { refresh, workspaceId } = useSitesWorkspaceData({ bootstrap: true })
  const [sites, setSites] = useAtom(sitesAtom)
  const [selectedId, setSelectedId] = useAtom(selectedSiteIdAtom)
  const setCreateOpen = useSetAtom(sitesCreateOpenAtom)
  const setPreviewUrl = useSetAtom(sitesPreviewUrlAtom)
  const setPreviewStatus = useSetAtom(sitesPreviewStatusAtom)
  const setSelectedFilePath = useSetAtom(sitesSelectedFilePathAtom)
  const loading = useAtomValue(sitesLoadingAtom)
  const error = useAtomValue(sitesErrorAtom)

  const selectSite = async (id: string) => {
    setSelectedId(id)
    setSelectedFilePath(null)
    if (!workspaceId) return
    const site = sites.find((s) => s.id === id)
    if (site?.previewUrl) {
      setPreviewUrl(site.previewUrl)
      setPreviewStatus(site.status)
      return
    }
    try {
      const preview = await window.electronAPI.sitesPreviewStart(workspaceId, id)
      setPreviewUrl(preview.previewUrl)
      setPreviewStatus(preview.status)
      if (site) {
        setSites((prev) =>
          upsertSiteInList(prev, {
            ...site,
            previewUrl: preview.previewUrl,
            previewPort: preview.previewPort,
            status: preview.status as typeof site.status,
          }),
        )
      }
    } catch {
      // Preview may fail until scaffold finishes; surface via status later
    }
  }

  const onCreated = async (siteId: string) => {
    toast.success(t('workbench.sites.siteCreated'))
    await refresh()
    await selectSite(siteId)
  }

  const removeSite = async (id: string) => {
    if (!workspaceId) return
    try {
      await window.electronAPI.sitesDelete(workspaceId, id)
      setSites((prev) => {
        const next = prev.filter((s) => s.id !== id)
        if (selectedId === id) {
          setSelectedId(next[0]?.id ?? null)
          setSelectedFilePath(null)
          setPreviewUrl(null)
          setPreviewStatus(null)
        }
        return next
      })
      toast.success(t('workbench.sites.siteDeleted'))
      void refreshSitesData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="relative h-full min-h-0">
      <ActivityShell
        title={t('workbench.sites.title')}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={t('workbench.sites.newSite')}
            disabled={!workspaceId}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {loading && sites.length === 0 ? (
          <SitesListSkeleton />
        ) : error && sites.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground space-y-2">
            <p className="text-destructive/90">{error}</p>
            {/sidecar|unavailable|ECONNREFUSED|fetch failed|not ready/i.test(error) ? (
              <p className="text-xs">{t('workbench.sites.sidecarHint')}</p>
            ) : null}
          </div>
        ) : sites.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground space-y-2">
            <p>{t('workbench.sites.emptyTitle')}</p>
            <p className="text-xs">{t('workbench.sites.emptyDescription')}</p>
          </div>
        ) : (
          <ul className="py-1" role="listbox" aria-label={t('workbench.sites.title')}>
            {sites.map((site) => {
              const active = selectedId === site.id
              return (
                <li key={site.id} className="group relative">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 pr-8 text-left',
                      'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
                      active && 'bg-foreground-10',
                    )}
                    onClick={() => void selectSite(site.id)}
                  >
                    <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-sm font-medium truncate">{site.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {site.template}
                        <span aria-hidden> · </span>
                        {site.status}
                      </div>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'absolute right-1 top-1.5 h-6 w-6 opacity-0 group-hover:opacity-100',
                      'focus-visible:opacity-100',
                    )}
                    title={t('workbench.sites.delete')}
                    onClick={(e) => {
                      e.stopPropagation()
                      void removeSite(site.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </ActivityShell>
      {workspaceId ? (
        <CreateSiteDialog workspaceId={workspaceId} onCreated={(id) => void onCreated(id)} />
      ) : null}
    </div>
  )
}
