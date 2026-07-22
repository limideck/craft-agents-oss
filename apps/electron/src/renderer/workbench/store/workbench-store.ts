import { atom } from 'jotai'
import type { DockviewApi } from 'dockview-react'
import * as storage from '@/lib/local-storage'
import { focusOrAddPanel, type PanelPlacement } from '../dock/layout-manager'

/** Active workbench module id (ActivityBar selection). */
export const activeModuleIdAtom = atom<string>('agents')

/**
 * Secondary activity sidebar (module list / Sessions / Sources, etc.).
 * ActivityBar icon rail stays visible; this toggles the wider rail next to it.
 */
const activitySidebarVisibleBaseAtom = atom<boolean>(
  storage.get(storage.KEYS.sidebarVisible, true),
)

export const activitySidebarVisibleAtom = atom(
  (get) => get(activitySidebarVisibleBaseAtom),
  (_get, set, next: boolean | ((prev: boolean) => boolean)) => {
    set(activitySidebarVisibleBaseAtom, (prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      storage.set(storage.KEYS.sidebarVisible, value)
      return value
    })
  },
)

/**
 * Focus mode hides the ActivityBar (icon rail) and the secondary
 * ActivitySidebar for distraction-free work. Independent of the per-module
 * sidebar visibility so toggling focus mode does not clobber that preference.
 */
export const focusModeAtom = atom(
  storage.get(storage.KEYS.focusModeEnabled, false),
  (get, set, next: boolean | ((prev: boolean) => boolean)) => {
    const prev = get(focusModeAtom)
    const value = typeof next === 'function' ? next(prev) : next
    storage.set(storage.KEYS.focusModeEnabled, value)
    set(focusModeAtom, value)
  },
)

/**
 * Module id that the *current dock layout* belongs to.
 * Lagged behind `activeModuleIdAtom` until WorkbenchShell finishes applying
 * the incoming layout — prevents debounced persists from writing the outgoing
 * Agents (etc.) snapshot under Sites/RSS keys mid-switch.
 */
export const layoutModuleIdAtom = atom<string>('agents')

/** Imperative dockview API handle (set on DockviewHost ready). */
export const dockviewApiAtom = atom<DockviewApi | null>(null)

/** Cancel pending debounced layout persist (set by DockviewHost). */
export const cancelLayoutPersistAtom = atom<(() => void) | null>(null)

/** Focus an existing panel or add it to the center group. */
export function focusOrAddWorkbenchPanel(options: {
  api: DockviewApi | null
  id: string
  component: string
  title: string
  params?: Record<string, unknown>
  referenceGroupId?: string
  placement?: PanelPlacement
}): void {
  if (!options.api) return
  focusOrAddPanel(options.api, options)
}
