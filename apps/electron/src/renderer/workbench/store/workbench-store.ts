import { atom } from 'jotai'
import type { DockviewApi } from 'dockview-react'
import { focusOrAddPanel } from '../dock/layout-manager'

/** Active workbench module id (ActivityBar selection). */
export const activeModuleIdAtom = atom<string>('agents')

/** Imperative dockview API handle (set on DockviewHost ready). */
export const dockviewApiAtom = atom<DockviewApi | null>(null)

/** Focus an existing panel or add it to the center group. */
export function focusOrAddWorkbenchPanel(options: {
  api: DockviewApi | null
  id: string
  component: string
  title: string
  params?: Record<string, unknown>
}): void {
  if (!options.api) return
  focusOrAddPanel(options.api, options)
}
