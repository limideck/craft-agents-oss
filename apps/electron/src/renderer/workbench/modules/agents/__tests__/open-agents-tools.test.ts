import { describe, expect, it, mock } from 'bun:test'
import { createStore } from 'jotai'
import type { DockviewApi } from 'dockview-react'
import { dockviewApiAtom } from '../../../store/workbench-store'
import {
  getOpenAgentsToolPanelIds,
  isAgentsRightToolsOpen,
  openAgentsRightTools,
  openAgentsToolPanel,
} from '../open-agents-tools'

type FakePanel = {
  id: string
  group?: { id: string }
  api: { setActive: ReturnType<typeof mock> }
}

function createFakeApi(options?: {
  panels?: FakePanel[]
  groups?: Array<{ id: string }>
  addPanel?: ReturnType<typeof mock>
}): DockviewApi {
  const panels = options?.panels ?? []
  const map = new Map(panels.map((p) => [p.id, p]))
  const groups = new Map<string, { id: string }>()
  for (const g of options?.groups ?? []) groups.set(g.id, g)
  for (const p of panels) {
    if (p.group) groups.set(p.group.id, p.group)
  }
  const addPanel = options?.addPanel ?? mock(() => {})
  return {
    getPanel: (id: string) => map.get(id) as never,
    getGroup: (id: string) => groups.get(id) as never,
    groups: [...groups.values()] as never,
    activePanel: panels[0] as never,
    addPanel,
    onDidAddPanel: () => ({ dispose: () => {} }),
    onDidRemovePanel: () => ({ dispose: () => {} }),
  } as unknown as DockviewApi
}

describe('open-agents-tools', () => {
  it('isAgentsRightToolsOpen detects any tool panel', () => {
    expect(isAgentsRightToolsOpen(null)).toBe(false)
    expect(isAgentsRightToolsOpen(createFakeApi())).toBe(false)
    expect(
      isAgentsRightToolsOpen(
        createFakeApi({
          panels: [{ id: 'files', api: { setActive: mock(() => {}) } }],
        }),
      ),
    ).toBe(true)
    expect(
      getOpenAgentsToolPanelIds(
        createFakeApi({
          panels: [
            { id: 'files', api: { setActive: mock(() => {}) } },
            { id: 'terminal', api: { setActive: mock(() => {}) } },
          ],
        }),
      ),
    ).toEqual(['files', 'terminal'])
  })

  it('openAgentsToolPanel focuses an existing panel without addPanel', () => {
    const setActive = mock(() => {})
    const addPanel = mock(() => {})
    const store = createStore()
    store.set(
      dockviewApiAtom,
      createFakeApi({
        panels: [{ id: 'changes', api: { setActive } }],
        addPanel,
      }),
    )
    openAgentsToolPanel({ id: 'changes', store })
    expect(setActive).toHaveBeenCalled()
    expect(addPanel).not.toHaveBeenCalled()
  })

  it('openAgentsToolPanel opens Files to the right of chat when tools are gone', () => {
    const addPanel = mock(() => {})
    const store = createStore()
    store.set(
      dockviewApiAtom,
      createFakeApi({
        panels: [
          {
            id: 'chat',
            group: { id: 'group-chat' },
            api: { setActive: mock(() => {}) },
          },
        ],
        addPanel,
      }),
    )
    openAgentsToolPanel({ id: 'files', store })
    expect(addPanel).toHaveBeenCalledTimes(1)
    const firstCall = addPanel.mock.calls.at(0)?.[0] as {
      id: string
      component: string
      position: { referenceGroup: string; direction: string }
    }
    expect(firstCall).toMatchObject({
      id: 'files',
      component: 'files',
      position: { referenceGroup: 'group-chat', direction: 'right' },
    })
  })

  it('openAgentsRightTools restores files, changes, and terminal', () => {
    const panels = new Map<string, FakePanel>([
      [
        'chat',
        {
          id: 'chat',
          group: { id: 'group-chat' },
          api: { setActive: mock(() => {}) },
        },
      ],
    ])
    const groups = new Map<string, { id: string }>([['group-chat', { id: 'group-chat' }]])
    const addPanelImpl = mock(
      (opts: { id: string; position?: { direction?: string; referenceGroup?: string } }) => {
        const groupId =
          opts.position?.direction === 'below'
            ? 'group-right-bottom'
            : opts.position?.direction === 'right'
              ? 'group-right-top'
              : (opts.position?.referenceGroup ?? 'group-right-top')
        groups.set(groupId, { id: groupId })
        panels.set(opts.id, {
          id: opts.id,
          group: { id: groupId },
          api: { setActive: mock(() => {}) },
        })
      },
    )
    const api = {
      getPanel: (id: string) => panels.get(id) as never,
      getGroup: (id: string) => groups.get(id) as never,
      groups: [] as never,
      activePanel: panels.get('chat') as never,
      addPanel: addPanelImpl,
      onDidAddPanel: () => ({ dispose: () => {} }),
      onDidRemovePanel: () => ({ dispose: () => {} }),
    } as unknown as DockviewApi
    const store = createStore()
    store.set(dockviewApiAtom, api)

    openAgentsRightTools({ store })

    const ids = addPanelImpl.mock.calls.map((c) => (c[0] as { id: string }).id)
    expect(ids).toEqual(['files', 'changes', 'terminal'])
  })
})
