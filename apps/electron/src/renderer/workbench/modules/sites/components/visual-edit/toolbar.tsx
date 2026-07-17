import { useEffect, useState, type RefObject } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAppShellContext } from '@/context/AppShellContext'
import {
  selectedSiteIdAtom,
  sitesSelectedFilePathAtom,
  sitesVisualEditEnabledAtom,
} from '../../store'
import {
  isVisualEditMessage,
  postVisualEditCommand,
  type VisualEditPayload,
} from './bridge'

type Props = {
  iframeRef: RefObject<HTMLIFrameElement | null>
}

/**
 * Visual-edit MVP toolbar: toggle pick mode + manual text apply via sitesVisualEditSave.
 */
export function VisualEditToolbar({ iframeRef }: Props) {
  const { t } = useTranslation()
  const { activeWorkspaceId } = useAppShellContext()
  const siteId = useAtomValue(selectedSiteIdAtom)
  const filePath = useAtomValue(sitesSelectedFilePathAtom)
  const [enabled, setEnabled] = useAtom(sitesVisualEditEnabledAtom)
  const [text, setText] = useState('')
  const [pending, setPending] = useState<VisualEditPayload | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    postVisualEditCommand(iframeRef.current, enabled ? 'enable' : 'disable')
  }, [enabled, iframeRef])

  useEffect(() => {
    if (!enabled) return
    const onMessage = (event: MessageEvent) => {
      if (!isVisualEditMessage(event.data)) return
      setPending(event.data.payload)
      if (event.data.payload.oldValue) setText(event.data.payload.oldValue)
      else if (event.data.payload.newValue) setText(event.data.payload.newValue)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [enabled])

  const apply = async () => {
    if (!activeWorkspaceId || !siteId || !text.trim()) return
    const targetPath = pending?.filePath || filePath
    if (!targetPath) {
      toast.error(t('workbench.sites.selectFile'))
      return
    }
    setBusy(true)
    try {
      await window.electronAPI.sitesVisualEditSave(activeWorkspaceId, {
        siteId,
        filePath: targetPath,
        edits: [
          {
            type: pending?.editType === 'style' ? 'style' : 'text',
            selector: pending?.selector,
            line: pending?.line,
            column: pending?.column,
            oldValue: pending?.oldValue,
            newValue: text.trim(),
            property: pending?.property,
          },
        ],
      })
      toast.success(t('workbench.sites.visualEditSaved'))
      setPending(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-border bg-card/95 px-2.5 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] font-medium border transition-colors',
            enabled
              ? 'border-foreground/30 bg-foreground-10 text-foreground'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setEnabled((v) => !v)}
        >
          {enabled ? t('workbench.sites.visualEditOn') : t('workbench.sites.visualEdit')}
        </button>
        <span className="text-[11px] text-muted-foreground truncate">
          {t('workbench.sites.visualEditHint')}
        </span>
      </div>
      {enabled ? (
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <Label htmlFor="sites-ve-text" className="text-[10px] text-muted-foreground">
              {t('workbench.sites.applyText')}
            </Label>
            <Input
              id="sites-ve-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-7 text-xs"
              placeholder={t('workbench.sites.applyTextPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void apply()
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0"
            disabled={busy || !text.trim()}
            onClick={() => void apply()}
          >
            {t('workbench.sites.apply')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
