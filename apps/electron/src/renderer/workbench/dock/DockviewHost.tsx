import { useCallback, useEffect, useMemo, useRef, type FunctionComponent, type RefObject } from 'react'
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import './dockview-theme.css'
import { themeCraft } from './dockview-theme'
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
import { activeModuleIdAtom, dockviewApiAtom } from '../store/workbench-store'

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
  const activeModuleId = useAtomValue(activeModuleIdAtom)
  const detachRef = useRef<(() => void) | null>(null)
  const moduleIdRef = useRef(activeModuleId)
  moduleIdRef.current = activeModuleId
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
      'changes',
      'terminal',
      'rss-feeds',
      'rss-article-list',
      'rss-reader',
    ]) {
      if (!map[key]) map[key] = PortalSlot
    }
    return map
  }, [])

  useEffect(() => {
    return () => {
      detachRef.current?.()
      detachRef.current = null
      panelPortalManager.releaseAll()
      setApi(null)
    }
  }, [setApi, workspaceId])

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api
      setApi(api)

      detachRef.current?.()

      const moduleId = storeRef.current.get(activeModuleIdAtom)
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
      const unsubPersist = createLayoutPersistence(workspaceId, () => moduleIdRef.current).attach(api)

      detachRef.current = () => {
        removeDisposable.dispose()
        unsubPersist()
      }
    },
    [setApi, workspaceId],
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
        theme={themeCraft}
        components={components}
        onReady={onReady}
        defaultRenderer="always"
        className="h-full"
      />
      <PanelPortalHost renderPanel={renderPanel} />
    </div>
  )
}
