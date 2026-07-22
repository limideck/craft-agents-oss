import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Plus, Webhook } from 'lucide-react'
import { AutomationsListPanel } from '@/components/automations/AutomationsListPanel'
import type { AutomationFilterKind } from '@/components/automations/types'
import { EntityListEmptyScreen } from '@/components/ui/entity-list-empty'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { Button } from '@/components/ui/button'
import { automationsAtom } from '@/atoms/automations'
import { useAppShellContext, useActiveWorkspace } from '@/context/AppShellContext'
import { cn } from '@/lib/utils'
import { WorkflowListView } from '../../workflows/activity/workflow-list-view'
import { dockviewApiAtom } from '../../../store/workbench-store'
import { ActivityShell } from '../../../shell/ActivityShell'
import { applyAutomationsSurfaceLayout } from '../apply-surface-layout'
import {
  automationFilterKindAtom,
  automationsSurfaceAtom,
  selectedAutomationIdAtom,
  type AutomationsSurface,
} from '../store'

const RULE_FILTERS: Array<{ id: AutomationFilterKind; labelKey: string }> = [
  { id: 'all', labelKey: 'workbench.automations.filterAll' },
  { id: 'scheduled', labelKey: 'sidebar.scheduled' },
  { id: 'app', labelKey: 'sidebar.eventBased' },
  { id: 'agent', labelKey: 'sidebar.agentic' },
]

function SurfaceSegment({
  surface,
  onChange,
}: {
  surface: AutomationsSurface
  onChange: (next: AutomationsSurface) => void
}) {
  const { t } = useTranslation()
  const segments: Array<{ id: AutomationsSurface; label: string }> = [
    { id: 'rules', label: t('workbench.automations.rules') },
    { id: 'flows', label: t('workbench.automations.flows') },
  ]

  return (
    <div
      className="flex shrink-0 gap-0.5 rounded-md bg-foreground-5 p-0.5 mx-2 my-1.5"
      role="tablist"
      aria-label={t('workbench.automations.surfaceLabel')}
    >
      {segments.map((seg) => {
        const active = surface === seg.id
        return (
          <button
            key={seg.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              'flex-1 px-2 py-1 text-[11px] font-medium rounded-[5px] transition-colors',
              active
                ? 'bg-background text-foreground shadow-minimal'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(seg.id)}
          >
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}

function RulesEmptyState({ onGoFlows }: { onGoFlows: () => void }) {
  const { t } = useTranslation()
  const activeWorkspace = useActiveWorkspace()

  return (
    <EntityListEmptyScreen
      icon={<Webhook />}
      title={t('workbench.automations.rulesEmptyTitle')}
      description={t('workbench.automations.rulesEmptyDescription')}
      docKey="automations"
    >
      {activeWorkspace?.rootPath ? (
        <EditPopover
          align="center"
          trigger={
            <button
              type="button"
              className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors"
            >
              {t('automations.addAutomation')}
            </button>
          }
          {...getEditConfig('automation-config', activeWorkspace.rootPath)}
        />
      ) : null}
      <button
        type="button"
        className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-foreground-5 transition-colors"
        onClick={onGoFlows}
      >
        {t('workbench.automations.needMultiStep')}
      </button>
    </EntityListEmptyScreen>
  )
}

function RulesListSection() {
  const { t } = useTranslation()
  const automations = useAtomValue(automationsAtom)
  const [filterKind, setFilterKind] = useAtom(automationFilterKindAtom)
  const [selectedId, setSelectedId] = useAtom(selectedAutomationIdAtom)
  const {
    onTestAutomation,
    onToggleAutomation,
    onDuplicateAutomation,
    onDeleteAutomation,
  } = useAppShellContext()
  const activeWorkspace = useActiveWorkspace()

  if (automations.length === 0) {
    return null // parent shows RulesEmptyState
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-2 pt-2 pb-1 flex flex-wrap gap-1 shrink-0">
        {RULE_FILTERS.map((f) => {
          const active = filterKind === f.id
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
              onClick={() => setFilterKind(f.id)}
            >
              {t(f.labelKey)}
            </button>
          )
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <AutomationsListPanel
          automations={automations}
          automationFilter={{ kind: filterKind }}
          onAutomationClick={(id) => setSelectedId(id)}
          onTestAutomation={onTestAutomation}
          onToggleAutomation={onToggleAutomation}
          onDuplicateAutomation={onDuplicateAutomation}
          onDeleteAutomation={onDeleteAutomation}
          selectedAutomationId={selectedId}
          workspaceRootPath={activeWorkspace?.rootPath}
        />
      </div>
    </div>
  )
}

/**
 * ActivityBar side rail — Rules | Flows segments + list for the active surface.
 */
export function AutomationsActivityView() {
  const { t } = useTranslation()
  const [surface, setSurface] = useAtom(automationsSurfaceAtom)
  const dockApi = useAtomValue(dockviewApiAtom)
  const automations = useAtomValue(automationsAtom)
  const { activeWorkspaceId } = useAppShellContext()
  const activeWorkspace = useActiveWorkspace()

  // Keep dock layout aligned with surface (Rules detail vs workflow-edit).
  // Defer so WorkbenchShell's module-switch applyLayout does not overwrite us.
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      applyAutomationsSurfaceLayout(dockApi, surface)
    }, 0)
    return () => window.clearTimeout(t)
  }, [surface, dockApi])

  if (!activeWorkspaceId) {
    return (
      <ActivityShell title={t('sidebar.automations')}>
        <div className="p-3 text-xs text-muted-foreground">{t('workbench.automations.noWorkspace')}</div>
      </ActivityShell>
    )
  }

  const newRuleAction =
    surface === 'rules' && activeWorkspace?.rootPath ? (
      <EditPopover
        align="end"
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={t('automations.addAutomation')}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        }
        {...getEditConfig('automation-config', activeWorkspace.rootPath)}
      />
    ) : undefined

  return (
    <ActivityShell
      title={t('sidebar.automations')}
      actions={newRuleAction}
      toolbar={<SurfaceSegment surface={surface} onChange={setSurface} />}
      scroll={false}
      bodyClassName="overflow-hidden"
    >
      {surface === 'rules' ? (
        automations.length === 0 ? (
          <RulesEmptyState onGoFlows={() => setSurface('flows')} />
        ) : (
          <RulesListSection />
        )
      ) : (
        <WorkflowListView embedded />
      )}
    </ActivityShell>
  )
}
