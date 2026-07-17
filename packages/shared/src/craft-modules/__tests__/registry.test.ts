/**
 * Unit tests for craft-modules prefer-builtin registry + context formatting.
 * See docs/craft-modules-agent-routing.md.
 */

import { describe, it, expect } from 'bun:test'
import {
  formatCraftModulesActiveLine,
  formatCraftModulesContextBlock,
  getCraftBuiltinModule,
  listCraftBuiltinModules,
} from '../registry.ts'
import { CRAFT_MODULES_SOURCE_SLUG } from '../mcp-source.ts'

describe('craft-modules registry', () => {
  it('registers rss (enabled), knowledge (disabled), workflows (enabled), sites (enabled)', () => {
    const mods = listCraftBuiltinModules()
    expect(mods.map((m) => m.id)).toEqual(['rss', 'knowledge', 'workflows', 'sites'])
    expect(getCraftBuiltinModule('rss')?.enabled).toBe(true)
    expect(getCraftBuiltinModule('rss')?.toolPrefix).toBe('rss_')
    expect(getCraftBuiltinModule('knowledge')?.enabled).toBe(false)
    expect(getCraftBuiltinModule('knowledge')?.toolPrefix).toBe('kb_')
    expect(getCraftBuiltinModule('workflows')?.enabled).toBe(true)
    expect(getCraftBuiltinModule('workflows')?.toolPrefix).toBe('wf_')
    expect(getCraftBuiltinModule('sites')?.enabled).toBe(true)
    expect(getCraftBuiltinModule('sites')?.toolPrefix).toBe('sites_')
    expect(mods.every((m) => m.preferBuiltin === true)).toBe(true)
  })

  it('formatCraftModulesContextBlock includes prefer-builtin policy and source slug', () => {
    const block = formatCraftModulesContextBlock()
    expect(block).toContain('<craft_modules>')
    expect(block).toContain('</craft_modules>')
    expect(block).toContain(CRAFT_MODULES_SOURCE_SLUG)
    expect(block).toContain('Prefer builtin Craft modules')
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

  it('includes workspace_id for craft-modules MCP tools when provided', () => {
    const block = formatCraftModulesContextBlock({
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
    const block = formatCraftModulesContextBlock({ activeModuleId: 'rss' })
    expect(block).toContain('Active workbench module: rss')
  })

  it('omitActiveLine suppresses the active line for stable catalog half', () => {
    const block = formatCraftModulesContextBlock({
      activeModuleId: 'rss',
      omitActiveLine: true,
    })
    expect(block).not.toContain('Active workbench module:')
  })

  it('formatCraftModulesActiveLine returns volatile wrapper or null', () => {
    expect(formatCraftModulesActiveLine(null)).toBeNull()
    expect(formatCraftModulesActiveLine('  ')).toBeNull()
    expect(formatCraftModulesActiveLine('workflows')).toBe(
      '<craft_modules_active>\nActive workbench module: workflows\n</craft_modules_active>',
    )
  })
})
