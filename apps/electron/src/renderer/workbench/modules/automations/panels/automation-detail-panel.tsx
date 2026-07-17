import * as React from 'react'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { AutomationInfoPage } from '@/components/automations/AutomationInfoPage'
import type { ExecutionEntry } from '@/components/automations/types'
import { automationsAtom } from '@/atoms/automations'
import { useAppShellContext } from '@/context/AppShellContext'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { selectedAutomationIdAtom } from '../store'

/**
 * Dock center panel for Rules — wraps classic AutomationInfoPage.
 */
export function AutomationDetailPanel() {
  const { t } = useTranslation()
  const automations = useAtomValue(automationsAtom)
  const selectedId = useAtomValue(selectedAutomationIdAtom)
  const {
    onTestAutomation,
    onToggleAutomation,
    onDuplicateAutomation,
    onDeleteAutomation,
    onReplayAutomation,
    automationTestResults,
    getAutomationHistory,
  } = useAppShellContext()

  const automation = selectedId
    ? automations.find((a) => a.id === selectedId)
    : undefined

  const [executions, setExecutions] = React.useState<ExecutionEntry[]>([])

  React.useEffect(() => {
    if (!selectedId || !getAutomationHistory) {
      setExecutions([])
      return
    }
    let stale = false
    getAutomationHistory(selectedId).then((entries) => {
      if (!stale) setExecutions(entries)
    })
    const cleanup = window.electronAPI.onAutomationsChanged(() => {
      if (!stale) {
        getAutomationHistory(selectedId).then((entries) => {
          if (!stale) setExecutions(entries)
        })
      }
    })
    return () => {
      stale = true
      cleanup()
    }
  }, [selectedId, getAutomationHistory])

  if (!automation) {
    return (
      <PanelRoot>
        <PanelHeaderBar>
          <span className="font-medium truncate">{t('workbench.automations.ruleDetail')}</span>
        </PanelHeaderBar>
        <PanelBody className="flex items-center justify-center text-muted-foreground text-sm">
          {t('workbench.automations.selectRule')}
        </PanelBody>
      </PanelRoot>
    )
  }

  return (
    <PanelRoot>
      <PanelBody padding={false} scroll className="flex flex-col">
        <AutomationInfoPage
          automation={automation}
          executions={executions}
          testResult={automationTestResults?.[automation.id]}
          onTest={onTestAutomation ? () => onTestAutomation(automation.id) : undefined}
          onToggleEnabled={onToggleAutomation ? () => onToggleAutomation(automation.id) : undefined}
          onDuplicate={onDuplicateAutomation ? () => onDuplicateAutomation(automation.id) : undefined}
          onDelete={onDeleteAutomation ? () => onDeleteAutomation(automation.id) : undefined}
          onReplay={onReplayAutomation}
        />
      </PanelBody>
    </PanelRoot>
  )
}
