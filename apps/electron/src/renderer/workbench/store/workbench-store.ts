import { atom } from 'jotai'
import type { DockviewApi } from 'dockview-react'
import { focusOrAddPanel, type PanelPlacement } from '../dock/layout-manager'

/** Active workbench module id (ActivityBar selection). */
export const activeModuleIdAtom = atom<string>('agents')

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
