/**
 * Tests for prefer-builtin source merge + craft-modules workspace defaults.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  mergePreferredBuiltinSourceSlugs,
  preferredBuiltinSlugsAdded,
} from '../preferred-builtin.ts'
import { listPreferredBuiltinSourceSlugs } from '../builtin-sources.ts'
import { createWorkspaceAtPath, loadWorkspaceConfig } from '../../workspaces/storage.ts'
import {
  ensureCraftModulesInWorkspaceDefaults,
  ensureCraftModulesMcpSource,
  CRAFT_MODULES_SOURCE_SLUG,
} from '../../craft-modules/mcp-source.ts'
import { loadSourceConfig } from '../storage.ts'

describe('preferred builtin source merge', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'preferred-builtin-'))
    createWorkspaceAtPath(workspaceRoot, 'Test WS')
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('listPreferredBuiltinSourceSlugs includes craft-modules', () => {
    expect(listPreferredBuiltinSourceSlugs()).toContain(CRAFT_MODULES_SOURCE_SLUG)
  })

  it('merge is a no-op when craft-modules Source is missing', () => {
    expect(mergePreferredBuiltinSourceSlugs(workspaceRoot, ['github'])).toEqual(['github'])
  })

  it('merge appends craft-modules when Source exists and is usable', async () => {
    await ensureCraftModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'test-token',
    })
    expect(mergePreferredBuiltinSourceSlugs(workspaceRoot, [])).toEqual([
      CRAFT_MODULES_SOURCE_SLUG,
    ])
    expect(mergePreferredBuiltinSourceSlugs(workspaceRoot, ['slack'])).toEqual([
      'slack',
      CRAFT_MODULES_SOURCE_SLUG,
    ])
    expect(
      mergePreferredBuiltinSourceSlugs(workspaceRoot, [CRAFT_MODULES_SOURCE_SLUG, 'slack']),
    ).toEqual([CRAFT_MODULES_SOURCE_SLUG, 'slack'])
  })

  it('preferredBuiltinSlugsAdded reports newly added preferred slugs', () => {
    expect(preferredBuiltinSlugsAdded([], [CRAFT_MODULES_SOURCE_SLUG])).toEqual([
      CRAFT_MODULES_SOURCE_SLUG,
    ])
    expect(
      preferredBuiltinSlugsAdded([CRAFT_MODULES_SOURCE_SLUG], [CRAFT_MODULES_SOURCE_SLUG]),
    ).toEqual([])
  })

  it('ensureCraftModulesMcpSource adds slug to workspace defaults', async () => {
    const result = await ensureCraftModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'tok',
    })
    expect(result.defaultsUpdated).toBe(true)
    const ws = loadWorkspaceConfig(workspaceRoot)
    expect(ws?.defaults?.enabledSourceSlugs).toContain(CRAFT_MODULES_SOURCE_SLUG)

    const again = await ensureCraftModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'tok',
    })
    expect(again.defaultsUpdated).toBe(false)
  })

  it('ensureCraftModulesInWorkspaceDefaults is idempotent', () => {
    expect(ensureCraftModulesInWorkspaceDefaults(workspaceRoot)).toBe(true)
    expect(ensureCraftModulesInWorkspaceDefaults(workspaceRoot)).toBe(false)
  })

  it('ensureCraftModulesMcpSource re-enables a disabled Source config', async () => {
    await ensureCraftModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'tok',
    })
    const cfg = loadSourceConfig(workspaceRoot, CRAFT_MODULES_SOURCE_SLUG)
    expect(cfg).toBeTruthy()
    cfg!.enabled = false
    const { saveSourceConfig } = await import('../storage.ts')
    saveSourceConfig(workspaceRoot, cfg!)

    await ensureCraftModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'tok',
    })
    expect(loadSourceConfig(workspaceRoot, CRAFT_MODULES_SOURCE_SLUG)?.enabled).toBe(true)
  })
})
