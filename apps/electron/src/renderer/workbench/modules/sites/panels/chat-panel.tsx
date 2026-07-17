import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChatPanel } from '../../agents/panels/chat-panel'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { useAppShellContext } from '@/context/AppShellContext'
import { selectedSiteAtom, sitesAtom } from '../store'
import { upsertSiteInList } from '../use-sites-data'

/**
 * Thin wrapper — reuses Agents ChatPanel with sessionId from the selected site.
 * Offers create-session (cwd = site.path) + sitesBindSession when unbound.
 *
 * Must not call `openAgentChat({ focusAgentsModule: true })` — that would steal
 * the ActivityBar selection back to Agents. Bind/render the session in-place.
 */
export function SitesChatPanel() {
  const { t } = useTranslation()
  const { activeWorkspaceId, onCreateSession } = useAppShellContext()
  const site = useAtomValue(selectedSiteAtom)
  const setSites = useSetAtom(sitesAtom)
  const [busy, setBusy] = useState(false)

  const bindSession = async () => {
    if (!activeWorkspaceId || !site) return
    setBusy(true)
    try {
      const session = await onCreateSession(activeWorkspaceId, {
        name: site.name,
        workingDirectory: site.path,
      })
      const updated = await window.electronAPI.sitesBindSession(
        activeWorkspaceId,
        site.id,
        session.id,
      )
      setSites((prev) => upsertSiteInList(prev, updated))
      toast.success(t('workbench.sites.sessionBound'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (!site) {
    return (
      <PanelRoot>
        <PanelHeaderBar>
          <span className="font-medium truncate">{t('workbench.sites.chat')}</span>
        </PanelHeaderBar>
        <PanelBody className="flex items-center justify-center text-muted-foreground text-sm">
          {t('workbench.sites.selectSite')}
        </PanelBody>
      </PanelRoot>
    )
  }

  if (!site.sessionId) {
    return (
      <PanelRoot>
        <PanelHeaderBar>
          <span className="font-medium truncate">{t('workbench.sites.chat')}</span>
        </PanelHeaderBar>
        <PanelBody className="flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground p-4">
          <p>{t('workbench.sites.sessionHint')}</p>
          <Button type="button" size="sm" disabled={busy || !activeWorkspaceId} onClick={() => void bindSession()}>
            {t('workbench.sites.createSession')}
          </Button>
        </PanelBody>
      </PanelRoot>
    )
  }

  return <ChatPanel params={{ sessionId: site.sessionId }} />
}
