import { useEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import type { CraftModulesSiteTemplate } from '@craft-agent/shared/craft-modules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { sitesCreateOpenAtom } from '../store'

type Props = {
  workspaceId: string
  onCreated: (siteId: string) => void
}

const TEMPLATES: Array<{ id: CraftModulesSiteTemplate; labelKey: string }> = [
  { id: 'blank', labelKey: 'workbench.sites.templateBlank' },
  { id: 'landing', labelKey: 'workbench.sites.templateLanding' },
  { id: 'website', labelKey: 'workbench.sites.templateWebsite' },
]

export function CreateSiteDialog({ workspaceId, onCreated }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useAtom(sitesCreateOpenAtom)
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<CraftModulesSiteTemplate>('blank')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => {
    setOpen(false)
    setName('')
    setTemplate('blank')
    setError(null)
    setBusy(false)
  }

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const site = await window.electronAPI.sitesCreate(workspaceId, {
        name: trimmed,
        template,
      })
      close()
      onCreated(site.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('workbench.sites.newSite')}
        className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">{t('workbench.sites.newSite')}</h2>
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="sites-name" className="text-xs">
              {t('workbench.sites.nameLabel')}
            </Label>
            <Input
              id="sites-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('workbench.sites.namePlaceholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('workbench.sites.templateLabel')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    template === tpl.id
                      ? 'border-foreground/30 bg-foreground-10 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-foreground-5',
                  )}
                  onClick={() => setTemplate(tpl.id)}
                >
                  {t(tpl.labelKey)}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submit()}
              disabled={busy || !name.trim()}
            >
              {busy ? t('workbench.sites.creating') : t('workbench.sites.create')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
