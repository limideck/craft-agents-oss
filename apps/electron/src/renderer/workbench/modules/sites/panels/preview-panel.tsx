import { useRef, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { RotateCw, Square } from 'lucide-react'
import { toast } from 'sonner'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { useAppShellContext } from '@/context/AppShellContext'
import {
  selectedSiteAtom,
  selectedSiteIdAtom,
  sitesAtom,
  sitesPreviewStatusAtom,
  sitesPreviewUrlAtom,
} from '../store'
import { upsertSiteInList } from '../use-sites-data'
import { VisualEditToolbar } from '../components/visual-edit/toolbar'

export function SitesPreviewPanel() {
  const { t } = useTranslation()
  const { activeWorkspaceId } = useAppShellContext()
  const site = useAtomValue(selectedSiteAtom)
  const siteId = useAtomValue(selectedSiteIdAtom)
  const [previewUrl, setPreviewUrl] = useAtom(sitesPreviewUrlAtom)
  const [status, setStatus] = useAtom(sitesPreviewStatusAtom)
  const setSites = useSetAtom(sitesAtom)
  const [busy, setBusy] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const restart = async () => {
    if (!activeWorkspaceId || !siteId) return
    setBusy(true)
    try {
      await window.electronAPI.sitesPreviewStop(activeWorkspaceId, siteId).catch(() => {})
      const result = await window.electronAPI.sitesPreviewStart(activeWorkspaceId, siteId)
      setPreviewUrl(result.previewUrl)
      setStatus(result.status)
      if (site) {
        setSites((prev) =>
          upsertSiteInList(prev, {
            ...site,
            previewUrl: result.previewUrl,
            previewPort: result.previewPort,
            status: result.status as typeof site.status,
          }),
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    if (!activeWorkspaceId || !siteId) return
    setBusy(true)
    try {
      await window.electronAPI.sitesPreviewStop(activeWorkspaceId, siteId)
      setPreviewUrl(null)
      setStatus('ready')
      if (site) {
        setSites((prev) =>
          upsertSiteInList(prev, {
            ...site,
            previewUrl: null,
            previewPort: null,
            status: 'ready',
          }),
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between">
        <span className="font-medium truncate">{t('workbench.sites.preview')}</span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={t('workbench.sites.restartPreview')}
            disabled={!siteId || busy}
            onClick={() => void restart()}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={t('workbench.sites.stopPreview')}
            disabled={!siteId || !previewUrl || busy}
            onClick={() => void stop()}
          >
            <Square className="h-3 w-3" />
          </Button>
        </div>
      </PanelHeaderBar>
      <PanelBody padding={false} scroll={false} className="flex flex-col">
        {!site ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground p-4">
            {t('workbench.sites.selectSite')}
          </div>
        ) : previewUrl ? (
          <iframe
            ref={iframeRef}
            title={t('workbench.sites.preview')}
            src={previewUrl}
            className="flex-1 min-h-0 w-full border-0 bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-sm text-muted-foreground">
            <p>{status ? `${t('workbench.sites.preview')} · ${status}` : t('workbench.sites.previewIdle')}</p>
            <Button type="button" size="sm" disabled={busy} onClick={() => void restart()}>
              {t('workbench.sites.restartPreview')}
            </Button>
          </div>
        )}
        {site ? <VisualEditToolbar iframeRef={iframeRef} /> : null}
      </PanelBody>
    </PanelRoot>
  )
}
