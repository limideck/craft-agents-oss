/**
 * Tests for prefer-builtin source merge + grose-modules workspace defaults.
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
  ensureGroseModulesInWorkspaceDefaults,
  ensureGroseModulesMcpSource,
  GROSE_MODULES_SOURCE_SLUG,
} from '../../grose-modules/mcp-source.ts'
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

  it('listPreferredBuiltinSourceSlugs includes grose-modules', () => {
    expect(listPreferredBuiltinSourceSlugs()).toContain(GROSE_MODULES_SOURCE_SLUG)
  })

  it('merge is a no-op when grose-modules Source is missing', () => {
    expect(mergePreferredBuiltinSourceSlugs(workspaceRoot, ['github'])).toEqual(['github'])
  })

  it('merge appends grose-modules when Source exists and is usable', async () => {
    await ensureGroseModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'test-token',
    })
    expect(mergePreferredBuiltinSourceSlugs(workspaceRoot, [])).toEqual([
      GROSE_MODULES_SOURCE_SLUG,
    ])
    expect(mergePreferredBuiltinSourceSlugs(workspaceRoot, ['slack'])).toEqual([
      'slack',
      GROSE_MODULES_SOURCE_SLUG,
    ])
    expect(
      mergePreferredBuiltinSourceSlugs(workspaceRoot, [GROSE_MODULES_SOURCE_SLUG, 'slack']),
    ).toEqual([GROSE_MODULES_SOURCE_SLUG, 'slack'])
  })

  it('preferredBuiltinSlugsAdded reports newly added preferred slugs', () => {
    expect(preferredBuiltinSlugsAdded([], [GROSE_MODULES_SOURCE_SLUG])).toEqual([
      GROSE_MODULES_SOURCE_SLUG,
    ])
    expect(
      preferredBuiltinSlugsAdded([GROSE_MODULES_SOURCE_SLUG], [GROSE_MODULES_SOURCE_SLUG]),
    ).toEqual([])
  })

  it('ensureGroseModulesMcpSource adds slug to workspace defaults', async () => {
    const result = await ensureGroseModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'tok',
    })
    expect(result.defaultsUpdated).toBe(true)
    const ws = loadWorkspaceConfig(workspaceRoot)
    expect(ws?.defaults?.enabledSourceSlugs).toContain(GROSE_MODULES_SOURCE_SLUG)

    const again = await ensureGroseModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'tok',
    })
    expect(again.defaultsUpdated).toBe(false)
  })

  it('ensureGroseModulesInWorkspaceDefaults is idempotent', () => {
    expect(ensureGroseModulesInWorkspaceDefaults(workspaceRoot)).toBe(true)
    expect(ensureGroseModulesInWorkspaceDefaults(workspaceRoot)).toBe(false)
  })

  it('ensureGroseModulesMcpSource re-enables a disabled Source config', async () => {
    await ensureGroseModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'tok',
    })
    const cfg = loadSourceConfig(workspaceRoot, GROSE_MODULES_SOURCE_SLUG)
    expect(cfg).toBeTruthy()
    cfg!.enabled = false
    const { saveSourceConfig } = await import('../storage.ts')
    saveSourceConfig(workspaceRoot, cfg!)

    await ensureGroseModulesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:4711',
      token: 'tok',
    })
    expect(loadSourceConfig(workspaceRoot, GROSE_MODULES_SOURCE_SLUG)?.enabled).toBe(true)
  })
})
