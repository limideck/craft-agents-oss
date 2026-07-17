import { describe, expect, it } from 'bun:test'
import { syncActiveCraftModuleFromSendOptions } from './active-craft-module.ts'

describe('syncActiveCraftModuleFromSendOptions', () => {
  it('sets activeCraftModuleId from send options', () => {
    let active: string | null | undefined = 'stale'
    const agent = {
      getPromptBuilder: () => ({
        setActiveCraftModuleId(id: string | null | undefined) {
          active = id ?? null
        },
      }),
    }

    syncActiveCraftModuleFromSendOptions(agent, { activeModuleId: 'rss' })
    expect(active).toBe('rss')
  })

  it('clears when options omit activeModuleId', () => {
    let active: string | null | undefined = 'rss'
    const agent = {
      getPromptBuilder: () => ({
        setActiveCraftModuleId(id: string | null | undefined) {
          active = id ?? null
        },
      }),
    }

    syncActiveCraftModuleFromSendOptions(agent, {})
    expect(active).toBeNull()

    syncActiveCraftModuleFromSendOptions(agent, undefined)
    expect(active).toBeNull()
  })
})
