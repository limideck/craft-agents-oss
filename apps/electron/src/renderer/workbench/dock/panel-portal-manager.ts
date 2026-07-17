/**
 * PanelPortalManager — registry for persistent dockview panel portals.
 *
 * When dockview calls `api.fromJSON()` during layout restore, panel React
 * components unmount/remount. Portals lift content out of that lifecycle so
 * chat state, editors, and other heavy trees survive layout switches.
 */

import type { DockviewPanelApi } from 'dockview-react'

export type PortalEntry = {
  element: HTMLDivElement
  component: string
  params: Record<string, unknown>
  api: DockviewPanelApi | null
  /** Optional scope id (e.g. workspace). Released via `releaseByScope`. */
  scopeId?: string
}

type Listener = () => void

export class PanelPortalManager {
  private entries = new Map<string, PortalEntry>()
  private listeners = new Set<Listener>()
  private version = 0

  getVersion(): number {
    return this.version
  }

  updateParams(panelId: string, params: Record<string, unknown>): void {
    const entry = this.entries.get(panelId)
    if (!entry) return
    entry.params = params
    this.version++
    this.notify()
  }

  acquire(
    panelId: string,
    component: string,
    params: Record<string, unknown>,
    api: DockviewPanelApi,
    scopeId?: string,
  ): PortalEntry {
    let entry = this.entries.get(panelId)
    if (!entry) {
      const el = document.createElement('div')
      el.style.display = 'contents'
      el.dataset.portalPanel = panelId
      entry = { element: el, component, params, api, scopeId }
      this.entries.set(panelId, entry)
      this.version++
      this.notify()
    } else {
      entry.api = api
      entry.params = params
      entry.component = component
      if (scopeId !== undefined) entry.scopeId = scopeId
    }
    return entry
  }

  release(panelId: string): void {
    const entry = this.entries.get(panelId)
    if (!entry) return
    entry.element.remove()
    entry.api = null
    this.entries.delete(panelId)
    this.version++
    this.notify()
  }

  releaseByScope(scopeId: string): void {
    const toRemove: string[] = []
    for (const [panelId, entry] of this.entries) {
      if (entry.scopeId === scopeId) toRemove.push(panelId)
    }
    if (toRemove.length === 0) return
    for (const panelId of toRemove) {
      const entry = this.entries.get(panelId)!
      entry.element.remove()
      entry.api = null
      this.entries.delete(panelId)
    }
    this.version++
    this.notify()
  }

  reconcile(livePanelIds: Set<string>): void {
    const toRemove: string[] = []
    for (const panelId of this.entries.keys()) {
      if (!livePanelIds.has(panelId)) toRemove.push(panelId)
    }
    if (toRemove.length === 0) return
    for (const panelId of toRemove) {
      const entry = this.entries.get(panelId)!
      entry.element.remove()
      entry.api = null
      this.entries.delete(panelId)
    }
    this.version++
    this.notify()
  }

  releaseAll(): void {
    if (this.entries.size === 0) return
    for (const entry of this.entries.values()) {
      entry.element.remove()
      entry.api = null
    }
    this.entries.clear()
    this.version++
    this.notify()
  }

  has(panelId: string): boolean {
    return this.entries.has(panelId)
  }

  get(panelId: string): PortalEntry | undefined {
    return this.entries.get(panelId)
  }

  ids(): string[] {
    return Array.from(this.entries.keys())
  }

  getAll(): Map<string, PortalEntry> {
    return this.entries
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const fn of this.listeners) fn()
  }
}

export const panelPortalManager = new PanelPortalManager()

export function setPanelTitle(panelId: string, title: string): void {
  const entry = panelPortalManager.get(panelId)
  if (entry?.api && entry.api.title !== title) {
    entry.api.setTitle(title)
  }
}
