/**
 * Unit tests for grose-modules prefer-builtin registry + context formatting.
 * See docs/grose-modules-agent-routing.md.
 */

import { describe, it, expect } from 'bun:test'
import {
  formatGroseModulesActiveLine,
  formatGroseModulesContextBlock,
  getGroseBuiltinModule,
  listGroseBuiltinModules,
} from '../registry.ts'
import { GROSE_MODULES_SOURCE_SLUG } from '../mcp-source.ts'

describe('grose-modules registry', () => {
  it('registers rss (enabled), knowledge (disabled), workflows (enabled), sites (enabled)', () => {
    const mods = listGroseBuiltinModules()
    expect(mods.map((m) => m.id)).toEqual(['rss', 'knowledge', 'workflows', 'sites'])
    expect(getGroseBuiltinModule('rss')?.enabled).toBe(true)
    expect(getGroseBuiltinModule('rss')?.toolPrefix).toBe('rss_')
    expect(getGroseBuiltinModule('knowledge')?.enabled).toBe(false)
    expect(getGroseBuiltinModule('knowledge')?.toolPrefix).toBe('kb_')
    expect(getGroseBuiltinModule('workflows')?.enabled).toBe(true)
    expect(getGroseBuiltinModule('workflows')?.toolPrefix).toBe('wf_')
    expect(getGroseBuiltinModule('sites')?.enabled).toBe(true)
    expect(getGroseBuiltinModule('sites')?.toolPrefix).toBe('sites_')
    expect(mods.every((m) => m.preferBuiltin === true)).toBe(true)
  })

  it('formatGroseModulesContextBlock includes prefer-builtin policy and source slug', () => {
    const block = formatGroseModulesContextBlock()
    expect(block).toContain('<grose_modules>')
    expect(block).toContain('</grose_modules>')
    expect(block).toContain(GROSE_MODULES_SOURCE_SLUG)
    expect(block).toContain('Prefer builtin Grose modules')
    expect(block).toContain('Do NOT create new API or MCP Sources')
    expect(block).toContain('rss (enabled)')
    expect(block).toContain('tools rss_*')
    expect(block).toContain('knowledge (disabled)')
    expect(block).toContain('tools kb_*')
    expect(block).toContain('workflows (enabled)')
    expect(block).toContain('tools wf_*')
    expect(block).toContain('sites (enabled)')
    expect(block).toContain('tools sites_*')
    expect(block).toContain('subscribe to feeds')
  })

  it('includes workspace_id for grose-modules MCP tools when provided', () => {
    const block = formatGroseModulesContextBlock({
      workspaceId: '9ab64bb1-5cd9-61c6-b79a-00ae1cda2b1d',
      omitActiveLine: true,
    })
    expect(block).toContain('workspace_id: 9ab64bb1-5cd9-61c6-b79a-00ae1cda2b1d')
    expect(block).toContain('Pass workspace_id:')
    expect(block).toContain('rss_list_feeds')
    expect(block).toContain('rootPath/modules')
    expect(block).not.toContain('Active workbench module:')
  })

  it('includes active workbench module line when provided', () => {
    const block = formatGroseModulesContextBlock({ activeModuleId: 'rss' })
    expect(block).toContain('Active workbench module: rss')
  })

  it('omitActiveLine suppresses the active line for stable catalog half', () => {
    const block = formatGroseModulesContextBlock({
      activeModuleId: 'rss',
      omitActiveLine: true,
    })
    expect(block).not.toContain('Active workbench module:')
  })

  it('formatGroseModulesActiveLine returns volatile wrapper or null', () => {
    expect(formatGroseModulesActiveLine(null)).toBeNull()
    expect(formatGroseModulesActiveLine('  ')).toBeNull()
    expect(formatGroseModulesActiveLine('workflows')).toBe(
      '<grose_modules_active>\nActive workbench module: workflows\n</grose_modules_active>',
    )
  })
})
