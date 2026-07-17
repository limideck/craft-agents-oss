import { atom } from 'jotai'
import type { AutomationFilterKind } from '@/components/automations/types'

/** Rules (automations.json) vs Flows (workflow canvas) surface within Automations. */
export type AutomationsSurface = 'rules' | 'flows'

/** Active Automations surface — defaults to Rules (restore entry point). */
export const automationsSurfaceAtom = atom<AutomationsSurface>('rules')

/** Selected rule id (automations.json matcher). */
export const selectedAutomationIdAtom = atom<string | null>(null)

/** Rules list filter (Scheduled / Event / Agentic), matching classic sidebar semantics. */
export const automationFilterKindAtom = atom<AutomationFilterKind>('all')
