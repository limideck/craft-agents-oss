import { useCallback, useEffect, useMemo, useRef, type FunctionComponent, type RefObject } from 'react'
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import './dockview-theme.css'
import { themeGrose } from './dockview-theme'
import { PanelPortalHost, usePortalSlot } from './panel-portal-host'
import { panelPortalManager } from './panel-portal-manager'
import { renderRegisteredPanel, getAllPanels } from '../registry/panel-registry'
import { getModule } from '../registry/module-registry'
import {
  applyLayout,
  agentsDefaultLayout,
  loadPersistedLayout,
  createLayoutPersistence,
  resolveModuleLayout,
} from './layout-manager'
import { useAtomValue, useSetAtom, useStore } from 'jotai'
import {
  activeModuleIdAtom,
  cancelLayoutPersistAtom,
  dockviewApiAtom,
  layoutModuleIdAtom,
} from '../store/workbench-store'

function PortalSlot(props: IDockviewPanelProps) {
  const containerRef = usePortalSlot(props)
  return <div ref={containerRef as RefObject<HTMLDivElement>} className="h-full w-full overflow-hidden" />
}

type DockviewHostProps = {
  workspaceId: string
}

/**
 * Dockview host + portal sibling.
 * Restores workspace+module-scoped layout from localStorage, else module default.
 */
export function DockviewHost({ workspaceId }: DockviewHostProps) {
  const store = useStore()
  const setApi = useSetAtom(dockviewApiAtom)
  const setCancelLayoutPersist = useSetAtom(cancelLayoutPersistAtom)
  const layoutModuleId = useAtomValue(layoutModuleIdAtom)
  const detachRef = useRef<(() => void) | null>(null)
  // Persist against the layout-owner module, not the ActivityBar selection mid-switch.
  const moduleIdRef = useRef(layoutModuleId)
  moduleIdRef.current = layoutModuleId
  const storeRef = useRef(store)
  storeRef.current = store

  const components = useMemo(() => {
    const map: Record<string, FunctionComponent<IDockviewPanelProps>> = {}
    for (const panel of getAllPanels()) {
      map[panel.component] = PortalSlot
    }
    for (const key of [
      'session-list',
      'chat',
      'files',
      'file-editor',
      'changes',
      'terminal',
      'rss-feeds',
      'rss-article-list',
      'rss-reader',
      'sites-chat',
      'sites-files',
      'sites-preview',
    ]) {
      if (!map[key]) map[key] = PortalSlot
    }
    return map
  }, [])

  useEffect(() => {
    return () => {
      detachRef.current?.()
      detachRef.current = null
      setCancelLayoutPersist(null)
      panelPortalManager.releaseAll()
      setApi(null)
    }
  }, [setApi, setCancelLayoutPersist, workspaceId])

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api
      setApi(api)

      detachRef.current?.()

      const moduleId = storeRef.current.get(activeModuleIdAtom)
      storeRef.current.set(layoutModuleIdAtom, moduleId)
      moduleIdRef.current = moduleId
      const mod = getModule(moduleId)
      const saved = loadPersistedLayout(workspaceId, moduleId)
      try {
        if (saved) {
          api.fromJSON(saved)
        } else {
          const layout = resolveModuleLayout(mod?.defaultLayout) ?? agentsDefaultLayout()
          applyLayout(api, layout, api.width || 1200, api.height || 800)
        }
      } catch (err) {
        console.warn('[workbench] layout restore failed — applying default', err)
        const layout = resolveModuleLayout(mod?.defaultLayout) ?? agentsDefaultLayout()
        applyLayout(api, layout, api.width || 1200, api.height || 800)
      }

      const removeDisposable = api.onDidRemovePanel((panel) => {
        panelPortalManager.release(panel.id)
      })
      const persistence = createLayoutPersistence(workspaceId, () => moduleIdRef.current)
      setCancelLayoutPersist(() => persistence.cancelPending)
      const unsubPersist = persistence.attach(api)

      detachRef.current = () => {
        removeDisposable.dispose()
        unsubPersist()
        setCancelLayoutPersist(null)
      }
    },
    [setApi, setCancelLayoutPersist, workspaceId],
  )

  const renderPanel = useCallback(
    (_panelId: string, component: string, params: Record<string, unknown>) => {
      return renderRegisteredPanel(component, params) ?? (
        <div className="p-3 text-sm text-muted-foreground">Unknown panel: {component}</div>
      )
    },
    [],
  )

  return (
    <div className="relative flex-1 min-h-0 min-w-0">
      <DockviewReact
        key={workspaceId}
        theme={themeGrose}
        components={components}
        onReady={onReady}
        defaultRenderer="always"
        className="h-full"
      />
      <PanelPortalHost renderPanel={renderPanel} />
    </div>
  )
}
