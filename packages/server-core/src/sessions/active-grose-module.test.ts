import { describe, expect, it } from 'bun:test'
import { syncActiveGroseModuleFromSendOptions } from './active-grose-module.ts'

describe('syncActiveGroseModuleFromSendOptions', () => {
  it('sets activeGroseModuleId from send options', () => {
    let active: string | null | undefined = 'stale'
    const agent = {
      getPromptBuilder: () => ({
        setActiveGroseModuleId(id: string | null | undefined) {
          active = id ?? null
        },
      }),
    }

    syncActiveGroseModuleFromSendOptions(agent, { activeModuleId: 'rss' })
    expect(active).toBe('rss')
  })

  it('clears when options omit activeModuleId', () => {
    let active: string | null | undefined = 'rss'
    const agent = {
      getPromptBuilder: () => ({
        setActiveGroseModuleId(id: string | null | undefined) {
          active = id ?? null
        },
      }),
    }

    syncActiveGroseModuleFromSendOptions(agent, {})
    expect(active).toBeNull()

    syncActiveGroseModuleFromSendOptions(agent, undefined)
    expect(active).toBeNull()
  })
})
