import React, { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { panelPortalManager } from './panel-portal-manager'
import type { IDockviewPanelProps } from 'dockview-react'

export type PortalRenderer = (
  panelId: string,
  component: string,
  params: Record<string, unknown>,
) => ReactNode

type PanelPortalHostProps = {
  renderPanel: PortalRenderer
}

/**
 * Renders panel content into persistent portal elements outside the dockview tree.
 * Mount as a sibling of `<DockviewReact>`.
 */
export function PanelPortalHost({ renderPanel }: PanelPortalHostProps) {
  useSyncExternalStore(
    useCallback((cb) => panelPortalManager.subscribe(cb), []),
    useCallback(() => panelPortalManager.getVersion(), []),
    useCallback(() => panelPortalManager.getVersion(), []),
  )

  const panelIds = panelPortalManager.ids()

  return (
    <>
      {panelIds.map((panelId) => {
        const entry = panelPortalManager.get(panelId)
        if (!entry) return null
        return createPortal(
          renderPanel(panelId, entry.component, entry.params),
          entry.element,
          panelId,
        )
      })}
    </>
  )
}

/**
 * Attaches the persistent portal element for `panelId` into the dockview
 * panel container on mount; detaches on unmount without destroying.
 */
export function usePortalSlot(
  props: IDockviewPanelProps,
  scopeId?: string,
): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const panelId = props.api.id
  const component = props.api.component
  const params = props.params ?? {}

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const entry = panelPortalManager.acquire(panelId, component, params, props.api, scopeId)

    container.appendChild(entry.element)
    const cancelRestore = restorePortalScroll(entry.element)

    const onScroll = (e: Event) => {
      const target = e.target
      if (target instanceof Element && entry.element.contains(target)) {
        const html = target as HTMLElement
        scrollSnapshots.set(target, { top: html.scrollTop, left: html.scrollLeft })
      }
    }
    entry.element.addEventListener('scroll', onScroll, true)

    return () => {
      cancelRestore()
      entry.element.removeEventListener('scroll', onScroll, true)
      if (entry.element.parentNode === container) {
        container.removeChild(entry.element)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount only when panel/scope identity changes
  }, [panelId, scopeId])

  useEffect(() => {
    const disposable = props.api.onDidParametersChange((next) => {
      panelPortalManager.updateParams(panelId, next as Record<string, unknown>)
    })
    return () => disposable.dispose()
  }, [panelId, props.api])

  return containerRef
}

const scrollSnapshots = new WeakMap<Element, { top: number; left: number }>()
const RESTORE_WINDOW_MS = 1500

function restorePortalScroll(portal: Element): () => void {
  const targets: Array<{ el: HTMLElement; snap: { top: number; left: number } }> = []
  const walker = document.createTreeWalker(portal, NodeFilter.SHOW_ELEMENT)
  let node = walker.nextNode() as HTMLElement | null
  while (node) {
    const snap = scrollSnapshots.get(node)
    if (snap && (snap.top > 0 || snap.left > 0)) {
      targets.push({ el: node, snap })
    }
    node = walker.nextNode() as HTMLElement | null
  }
  if (targets.length === 0) return () => {}

  const pending = new Set(targets.map((t) => t.el))
  let cancelled = false
  let stopId = 0
  let ro: ResizeObserver | null = null

  const stop = () => {
    cancelled = true
    ro?.disconnect()
    window.clearTimeout(stopId)
  }

  const apply = () => {
    for (const { el, snap } of targets) {
      if (!pending.has(el)) continue
      if (el.scrollTop < snap.top) el.scrollTop = snap.top
      if (el.scrollLeft < snap.left) el.scrollLeft = snap.left
      const canReachTop = el.scrollHeight - el.clientHeight >= snap.top
      const canReachLeft = el.scrollWidth - el.clientWidth >= snap.left
      if (canReachTop && canReachLeft) pending.delete(el)
    }
    if (pending.size === 0) stop()
  }
  apply()

  if (!cancelled) {
    ro = new ResizeObserver(() => {
      if (cancelled) return
      apply()
    })
    for (const { el } of targets) ro.observe(el)
    requestAnimationFrame(() => {
      if (cancelled) return
      apply()
      requestAnimationFrame(() => {
        if (cancelled) return
        apply()
      })
    })
    stopId = window.setTimeout(stop, RESTORE_WINDOW_MS)
  }

  return stop
}
