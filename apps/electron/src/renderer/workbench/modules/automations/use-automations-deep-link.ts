import * as React from 'react'
import { useSetAtom, useStore } from 'jotai'
import {
  isAutomationsNavigation,
  useNavigationState,
} from '@/contexts/NavigationContext'
import { AUTOMATION_TYPE_TO_FILTER_KIND } from '@/components/automations/types'
import { activeModuleIdAtom, dockviewApiAtom } from '../../store/workbench-store'
import { applyAutomationsSurfaceLayout } from './apply-surface-layout'
import {
  automationFilterKindAtom,
  automationsSurfaceAtom,
  selectedAutomationIdAtom,
} from './store'

/**
 * When classic automations routes are active, switch Workbench to the
 * Automations module + Rules surface and select the automation id / filter.
 */
export function useAutomationsDeepLink(): void {
  const navState = useNavigationState()
  const setActiveModuleId = useSetAtom(activeModuleIdAtom)
  const setSurface = useSetAtom(automationsSurfaceAtom)
  const setSelectedId = useSetAtom(selectedAutomationIdAtom)
  const setFilterKind = useSetAtom(automationFilterKindAtom)
  const store = useStore()

  // Track last applied route signature to avoid re-applying layout every render
  const lastKeyRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!isAutomationsNavigation(navState)) {
      lastKeyRef.current = null
      return
    }

    const automationId = navState.details?.automationId ?? null
    const filterType = navState.filter?.automationType ?? null
    const key = `automations:${filterType ?? 'all'}:${automationId ?? ''}`
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key

    setActiveModuleId('automations')
    setSurface('rules')
    setSelectedId(automationId)
    setFilterKind(
      filterType ? (AUTOMATION_TYPE_TO_FILTER_KIND[filterType] ?? 'all') : 'all',
    )

    // Ensure Rules dock layout after module switch settles
    const api = store.get(dockviewApiAtom)
    if (api) {
      applyAutomationsSurfaceLayout(api, 'rules')
    } else {
      // Dock API may not be ready yet (module switch remounts); retry shortly
      const t = window.setTimeout(() => {
        applyAutomationsSurfaceLayout(store.get(dockviewApiAtom), 'rules')
      }, 50)
      return () => window.clearTimeout(t)
    }
  }, [
    navState,
    setActiveModuleId,
    setSurface,
    setSelectedId,
    setFilterKind,
    store,
  ])
}
