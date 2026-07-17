import { describe, expect, it } from 'bun:test'
import { toSerializedDockview } from '../applier'
import type { LayoutState } from '../../../registry/types'

describe('toSerializedDockview', () => {
  it('always emits a branch root — even for a single-column layout', () => {
    const state: LayoutState = {
      columns: [
        {
          id: 'center',
          width: 1,
          groups: [
            {
              id: 'group-settings',
              panels: [
                {
                  id: 'settings-page',
                  component: 'settings-page',
                  title: 'Settings',
                },
              ],
            },
          ],
        },
      ],
    }

    const serialized = toSerializedDockview(state, 1200, 800)

    // dockview fromJSON throws if root is a leaf (clears first → blank dock)
    expect(serialized.grid.root.type).toBe('branch')
    expect(Array.isArray(serialized.grid.root.data)).toBe(true)
    expect(serialized.panels['settings-page']?.contentComponent).toBe('settings-page')
  })

  it('emits a branch root for multi-column layouts', () => {
    const state: LayoutState = {
      columns: [
        {
          id: 'left',
          width: 0.3,
          groups: [{ id: 'g1', panels: [{ id: 'a', component: 'a', title: 'A' }] }],
        },
        {
          id: 'right',
          width: 0.7,
          groups: [{ id: 'g2', panels: [{ id: 'b', component: 'b', title: 'B' }] }],
        },
      ],
    }

    const serialized = toSerializedDockview(state, 1000, 600)
    expect(serialized.grid.root.type).toBe('branch')
    expect(serialized.grid.root.data).toHaveLength(2)
  })
})
