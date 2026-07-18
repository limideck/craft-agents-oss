import { useCallback, useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Eye, FileText, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Markdown, Spinner } from '@grose-agent/ui'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppShellContext } from '@/context/AppShellContext'
import { selectedSiteAtom, selectedSiteIdAtom } from '../store'

/** Site plan lives at project root — visible to the site-bound agent cwd. */
export const SITE_PLAN_PATH = 'PLAN.md'

const EMPTY_PLAN = `# Plan

## Goals

-

## Steps

1.
`

/**
 * Plan panel — editable PLAN.md for the selected site (kandev Plan tab role).
 * Saved into the site project so the agent can read/update it in-session.
 */
export function SitesPlanPanel() {
  const { t } = useTranslation()
  const { activeWorkspaceId } = useAppShellContext()
  const site = useAtomValue(selectedSiteAtom)
  const siteId = useAtomValue(selectedSiteIdAtom)

  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [missing, setMissing] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const dirty = content !== original

  const load = useCallback(async () => {
    if (!activeWorkspaceId || !siteId) {
      setContent('')
      setOriginal('')
      setMissing(false)
      return
    }
    setLoading(true)
    try {
      const res = await window.electronAPI.sitesReadFile(
        activeWorkspaceId,
        siteId,
        SITE_PLAN_PATH,
      )
      setContent(res.content)
      setOriginal(res.content)
      setMissing(false)
    } catch {
      setContent('')
      setOriginal('')
      setMissing(true)
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, siteId])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (nextContent?: string) => {
      if (!activeWorkspaceId || !siteId) return
      const body = nextContent ?? content
      setSaving(true)
      try {
        await window.electronAPI.sitesWriteFile(activeWorkspaceId, siteId, {
          path: SITE_PLAN_PATH,
          content: body,
        })
        setContent(body)
        setOriginal(body)
        setMissing(false)
        toast.success(t('workbench.sites.planSaved', { defaultValue: 'Plan saved' }))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err))
      } finally {
        setSaving(false)
      }
    },
    [activeWorkspaceId, siteId, content, t],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (dirty && !saving) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, saving, save])

  const createPlan = async () => {
    await save(EMPTY_PLAN)
    setMode('edit')
  }

  if (!site) {
    return (
      <PanelRoot>
        <PanelBody className="flex items-center justify-center text-sm text-muted-foreground">
          {t('workbench.sites.selectSite')}
        </PanelBody>
      </PanelRoot>
    )
  }

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-xs">{t('workbench.sites.plan')}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{SITE_PLAN_PATH}</span>
          {dirty ? <span className="shrink-0 text-[10px] text-amber-600">●</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!missing ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
            >
              {mode === 'edit' ? (
                <>
                  <Eye className="mr-1 h-3 w-3" />
                  {t('workbench.sites.preview', { defaultValue: 'Preview' })}
                </>
              ) : (
                t('workbench.sites.editFile', { defaultValue: 'Edit' })
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            title={t('workbench.sites.saveFile', { defaultValue: 'Save' })}
            disabled={(!dirty && !missing) || saving || loading}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </PanelHeaderBar>

      <PanelBody padding={false} scroll={false} className="flex min-h-0 flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" /> {t('common.loading')}
          </div>
        ) : missing ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
            <FileText className="h-7 w-7 opacity-40" />
            <p>{t('workbench.sites.planEmpty', { defaultValue: 'No plan yet for this site.' })}</p>
            <p className="max-w-sm text-xs leading-relaxed opacity-80">
              {t('workbench.sites.planEmptyHint', {
                defaultValue:
                  'Create PLAN.md in the site root. The agent can read and update it while editing.',
              })}
            </p>
            <Button type="button" size="sm" onClick={() => void createPlan()}>
              {t('workbench.sites.planCreate', { defaultValue: 'Create plan' })}
            </Button>
          </div>
        ) : mode === 'preview' ? (
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <Markdown className="prose prose-sm dark:prose-invert max-w-none">{content}</Markdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className={cn(
              'min-h-0 flex-1 w-full resize-none border-0 bg-transparent',
              'p-3 font-mono text-[12px] leading-relaxed text-foreground',
              'focus-visible:outline-none',
            )}
            aria-label={SITE_PLAN_PATH}
            placeholder={EMPTY_PLAN}
          />
        )}
      </PanelBody>
    </PanelRoot>
  )
}
