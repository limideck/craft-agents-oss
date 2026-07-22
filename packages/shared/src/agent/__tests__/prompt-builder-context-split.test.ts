/**
 * Guards the volatile/stable context split (issue #862).
 *
 * The Pi adapter folded volatile context (date/time, session_state, sources)
 * into the cached system prefix, re-stamping it every turn and killing
 * prompt-cache reuse. The fix splits PromptBuilder.buildContextParts() into
 * buildVolatileContextParts() + buildStableContextParts() so the Pi path can
 * keep stable blocks in the system prompt and route volatile blocks to the user
 * tail (where the Claude path already puts everything).
 *
 * These tests pin three invariants:
 *  1. buildContextParts === [...volatile, ...stable] — the Claude path output is
 *     unchanged (same blocks, same order).
 *  2. Blocks are routed correctly: session_state + sources are volatile;
 *     workspace capabilities is stable.
 *  3. The one-shot mode-change signal is consumed exactly once, and only by the
 *     volatile builder — never by the stable builder.
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { TestAgent, createMockBackendConfig } from './test-utils.ts'
import { cleanupModeState, initializeModeState, setPermissionMode } from '../mode-manager.ts'

// Matches createMockSession() in test-utils.ts
const SESSION_ID = 'test-session-id'
const OPTS = {
  plansFolderPath: '/tmp/plans',
  dataFolderPath: '/tmp/data',
  mydataFolderPath: '/test/workspace/mydata',
}
const SOURCE_BLOCK = '<sources>\nActive: none\n</sources>'

function makeBuilder() {
  return new TestAgent(createMockBackendConfig()).getPromptBuilder()
}

describe('PromptBuilder volatile/stable context split (issue #862)', () => {
  afterEach(() => cleanupModeState(SESSION_ID))

  it('buildContextParts equals [...volatile, ...stable] (Claude path stays byte-identical)', () => {
    // No pending one-shot signal → consume is a no-op → repeated calls are stable.
    cleanupModeState(SESSION_ID)
    const builder = makeBuilder()
    const composed = [
      ...builder.buildVolatileContextParts(OPTS, SOURCE_BLOCK),
      ...builder.buildStableContextParts(),
    ]
    const combined = builder.buildContextParts(OPTS, SOURCE_BLOCK)
    expect(combined).toEqual(composed)
  })

  it('routes session_state + sources to volatile and workspace capabilities + grose_modules to stable', () => {
    cleanupModeState(SESSION_ID)
    const builder = makeBuilder()
    const volatileText = builder.buildVolatileContextParts(OPTS, SOURCE_BLOCK).join('\n')
    const stableText = builder.buildStableContextParts().join('\n')

    // session_state + source ride the volatile tail
    expect(volatileText).toContain('permissionMode:')
    expect(volatileText).toContain('mydataFolderPath:')
    expect(volatileText).toContain(SOURCE_BLOCK)
    // workspace capabilities + grose_modules catalog are stable
    expect(stableText).toContain('<workspace_capabilities>')
    expect(stableText).toContain('<grose_modules>')
    expect(stableText).toContain('Prefer builtin Grose modules')
    expect(stableText).toContain('workspace_id:')
    expect(stableText).not.toContain('Active workbench module:')

    // The halves must not bleed into each other
    expect(volatileText).not.toContain('<workspace_capabilities>')
    expect(volatileText).not.toContain('<grose_modules>')
    expect(stableText).not.toContain('permissionMode:')
  })

  it('puts active grose module line in volatile when set', () => {
    cleanupModeState(SESSION_ID)
    const builder = makeBuilder()
    builder.setActiveGroseModuleId('rss')
    const volatileText = builder.buildVolatileContextParts(OPTS, SOURCE_BLOCK).join('\n')
    const stableText = builder.buildStableContextParts().join('\n')

    expect(volatileText).toContain('<grose_modules_active>')
    expect(volatileText).toContain('Active workbench module: rss')
    expect(stableText).toContain('<grose_modules>')
    expect(stableText).not.toContain('Active workbench module:')
  })

  it('consumes the one-shot mode-change signal exactly once, only on the volatile path', () => {
    initializeModeState(SESSION_ID, 'safe')
    setPermissionMode(SESSION_ID, 'allow-all', {
      changedBy: 'user',
      changedAt: '2026-03-02T10:00:00.000Z',
    })
    const builder = makeBuilder()

    // Stable path never touches the one-shot signal.
    expect(builder.buildStableContextParts().join('\n')).not.toContain('modeChangeUserSignal:')

    // Volatile path emits it on the first call, then never again.
    const first = builder.buildVolatileContextParts(OPTS, SOURCE_BLOCK).join('\n')
    const second = builder.buildVolatileContextParts(OPTS, SOURCE_BLOCK).join('\n')
    expect(first).toContain('modeChangeUserSignal:')
    expect(second).not.toContain('modeChangeUserSignal:')
  })
})
