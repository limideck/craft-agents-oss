/**
 * VoiceSettingsPage
 *
 * Manage the local speech-to-text model (SenseVoice Small) used for voice
 * input in the chat composer. Allows downloading / deleting the model and
 * checking microphone permission.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/ui/panel-header'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { routes } from '@/lib/navigate'
import { Spinner } from '@grose-agent/ui'
import { Button } from '@/components/ui/button'
import { SettingsSection, SettingsCard, SettingsRow } from '@/components/settings'
import { toast } from 'sonner'
import { Mic, Trash2, Download, CheckCircle2, AlertCircle, Settings } from 'lucide-react'
import type { DetailsPageMeta } from '@/lib/navigation-registry'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'voice',
}

interface VoiceModelStatus {
  installed: boolean
  modelDir: string
  modelSize?: number
  missingFiles?: string[]
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  const kb = bytes / 1024
  return `${kb.toFixed(0)} KB`
}

export default function VoiceSettingsPage() {
  const { t } = useTranslation()

  const [status, setStatus] = React.useState<VoiceModelStatus | null>(null)
  const [downloading, setDownloading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [deleting, setDeleting] = React.useState(false)
  const [micAllowed, setMicAllowed] = React.useState<boolean | null>(null)

  const refreshStatus = React.useCallback(async () => {
    try {
      const s = await window.electronAPI.getVoiceModelStatus()
      setStatus(s)
    } catch {
      setStatus({ installed: false, modelDir: '' })
    }
  }, [])

  React.useEffect(() => {
    void refreshStatus()
    const checkMic = () =>
      window.electronAPI.requestMicPermission().then((r) => setMicAllowed(r.granted)).catch(() => setMicAllowed(null))
    void checkMic()
    const onFocus = () => void checkMic()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshStatus])

  const handleDownload = React.useCallback(async () => {
    setDownloading(true)
    setProgress(0)
    const off = window.electronAPI.onVoiceDownloadProgress((p) => setProgress(p))
    try {
      const res = await window.electronAPI.downloadVoiceModel()
      if (res.success) {
        toast.success(t('voice.downloadDone'))
        await refreshStatus()
      } else if (res.alreadyInstalled) {
        toast.info(t('voice.alreadyInstalled'))
        await refreshStatus()
      } else {
        toast.error(res.error || t('voice.downloadFailed'))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      off?.()
      setDownloading(false)
      setProgress(0)
    }
  }, [refreshStatus, t, toast])

  const handleDelete = React.useCallback(async () => {
    setDeleting(true)
    try {
      const res = await window.electronAPI.deleteVoiceModel()
      if (res.success) {
        toast.success(t('voice.deleted'))
        await refreshStatus()
      } else {
        toast.error(res.error || t('voice.deleteFailed'))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }, [refreshStatus, t, toast])

  const handleRequestMic = React.useCallback(async () => {
    try {
      const ok = await window.electronAPI.requestMicPermission()
      setMicAllowed(ok.granted)
      if (!ok) toast.error(t('voice.micDenied'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [t, toast])

  const handleOpenSettings = React.useCallback(async () => {
    try {
      await window.electronAPI.openMicSettings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [toast])

  const installed = status?.installed ?? false

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title={t('settings.voice.title')}
        actions={<HeaderMenu route={routes.view.settings('voice')} helpFeature="voice" />}
      />
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-6 space-y-8">
          <SettingsSection
            title={t('voice.modelTitle')}
            description={t('voice.modelDescription')}
          >
            <SettingsCard>
              <SettingsRow
                label={t('voice.modelName')}
                description={
                  installed
                    ? `${t('voice.installedAt')} ${status?.modelDir}`
                    : t('voice.notInstalled')
                }
              >
                {installed ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {formatBytes(status?.modelSize)}
                  </span>
                ) : downloading ? (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4" />
                    {progress > 0 ? `${progress}%` : t('voice.downloading')}
                  </span>
                ) : (
                  <Button size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                    {t('voice.download')}
                  </Button>
                )}
              </SettingsRow>

              {downloading && progress > 0 && (
                <div className="px-4 pb-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {installed && !downloading && (
                <SettingsRow
                  label={t('voice.removeTitle')}
                  description={t('voice.removeDescription')}
                >
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {t('voice.delete')}
                  </Button>
                </SettingsRow>
              )}
            </SettingsCard>

            {!installed && !downloading && (
              <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                {t('voice.modelNote')}
              </p>
            )}
          </SettingsSection>

          <SettingsSection
            title={t('voice.micTitle')}
            description={t('voice.micDescription')}
          >
            <SettingsCard>
              <SettingsRow
                label={t('voice.micPermission')}
                description={
                  micAllowed === false
                    ? t('voice.micDeniedHint')
                    : t('voice.micPermissionHint')
                }
              >
                {micAllowed === true ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('voice.granted')}
                  </span>
                ) : micAllowed === false ? (
                  <Button size="sm" variant="outline" onClick={handleOpenSettings}>
                    <Settings className="h-4 w-4" />
                    {t('voice.openSettings')}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleRequestMic}>
                    <Mic className="h-4 w-4" />
                    {t('voice.requestMic')}
                  </Button>
                )}
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  )
}
