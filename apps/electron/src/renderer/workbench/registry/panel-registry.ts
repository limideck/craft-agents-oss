import type { ReactNode } from 'react'
import type { PanelContribution } from './types'

const panels = new Map<string, PanelContribution>()

export function registerPanel(contribution: PanelContribution): void {
  if (panels.has(contribution.component)) {
    console.warn(`[workbench] panel "${contribution.component}" already registered — overwriting`)
  }
  panels.set(contribution.component, contribution)
}

export function getPanel(component: string): PanelContribution | undefined {
  return panels.get(component)
}

export function getAllPanels(): PanelContribution[] {
  return Array.from(panels.values())
}

export function renderRegisteredPanel(
  component: string,
  params: Record<string, unknown>,
): ReactNode {
  const entry = panels.get(component)
  if (!entry) {
    return null
  }
  return entry.render(params)
}

/** Clear registry (tests / HMR). */
export function clearPanelRegistry(): void {
  panels.clear()
}
