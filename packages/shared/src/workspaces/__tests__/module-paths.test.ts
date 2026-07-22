/**
 * Workspace module path helpers — rootPath-only storage contract.
 * See docs/workspace-storage.md.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  WORKSPACE_MYDATA_DIR,
  createWorkspaceAtPath,
  ensureWorkspaceModuleDirs,
  ensureWorkspaceMydataDir,
  ensureWorkspaceMydataDefaults,
  getWorkspaceModulePath,
  getWorkspaceMydataPath,
  getWorkspaceRssDbPath,
  getWorkspaceSitesDbPath,
  getWorkspaceSitesPath,
  getWorkspaceTablesDataPath,
  getWorkspaceWorkflowsDbPath,
  getWorkspaceWorkflowsDefinitionsPath,
  loadWorkspace,
  loadWorkspaceConfig,
} from '../storage.ts'

describe('workspace module paths', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ws-modules-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('builds module paths under rootPath, not under workspace id', () => {
    const id = '9ab64bb1-5cd9-61c6-b79a-00ae1cda2b1d'
    expect(getWorkspaceRssDbPath(root)).toBe(join(root, 'modules', 'rss', 'rss.db'))
    expect(getWorkspaceWorkflowsDbPath(root)).toBe(
      join(root, 'modules', 'workflows', 'workflows.db'),
    )
    expect(getWorkspaceTablesDataPath(root)).toBe(join(root, 'modules', 'tables'))
    expect(getWorkspaceSitesPath(root)).toBe(join(root, 'modules', 'sites'))
    expect(getWorkspaceSitesDbPath(root)).toBe(join(root, 'modules', 'sites', 'sites.db'))
    expect(getWorkspaceModulePath(root, 'knowledge')).toBe(join(root, 'modules', 'knowledge'))
    expect(getWorkspaceRssDbPath(root)).not.toContain(id)
  })

  it('getWorkspaceMydataPath uses WORKSPACE_MYDATA_DIR under rootPath', () => {
    expect(WORKSPACE_MYDATA_DIR).toBe('mydata')
    expect(getWorkspaceMydataPath(root)).toBe(join(root, 'mydata'))
  })

  it('ensureWorkspaceMydataDir creates mydata', () => {
    ensureWorkspaceMydataDir(root)
    expect(existsSync(join(root, 'mydata'))).toBe(true)
    // Idempotent
    ensureWorkspaceMydataDir(root)
    expect(existsSync(join(root, 'mydata'))).toBe(true)
  })

  it('ensureWorkspaceModuleDirs creates reserved tree', () => {
    ensureWorkspaceModuleDirs(root)
    expect(existsSync(join(root, 'modules', 'rss'))).toBe(true)
    expect(existsSync(join(root, 'modules', 'tables'))).toBe(true)
    expect(existsSync(join(root, 'modules', 'workflows'))).toBe(true)
    expect(existsSync(join(root, 'modules', 'sites'))).toBe(true)
    expect(existsSync(getWorkspaceWorkflowsDefinitionsPath(root))).toBe(true)
    expect(existsSync(join(root, 'modules', 'knowledge', 'docs'))).toBe(true)
    expect(existsSync(join(root, 'modules', 'knowledge', 'index'))).toBe(true)
  })

  it('createWorkspaceAtPath ensures modules dirs, mydata, and default cwd', () => {
    const wsRoot = join(root, 'acme-slug')
    createWorkspaceAtPath(wsRoot, 'Acme', undefined, 'uuid-workspace-1')
    expect(existsSync(join(wsRoot, 'modules', 'rss'))).toBe(true)
    expect(existsSync(join(wsRoot, 'modules', 'tables'))).toBe(true)
    expect(existsSync(join(wsRoot, 'modules', 'workflows', 'definitions'))).toBe(true)
    expect(existsSync(join(wsRoot, 'modules', 'sites'))).toBe(true)
    expect(existsSync(join(wsRoot, 'mydata'))).toBe(true)

    const config = loadWorkspaceConfig(wsRoot)
    expect(config?.defaults?.workingDirectory).toBe(join(wsRoot, 'mydata'))
  })

  it('loadWorkspace backfills mydata and default cwd for existing workspaces', () => {
    const wsRoot = join(root, 'legacy-ws')
    mkdirSync(wsRoot, { recursive: true })
    writeFileSync(
      join(wsRoot, 'config.json'),
      JSON.stringify({
        id: 'ws_legacy',
        name: 'Legacy',
        slug: 'legacy-ws',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      'utf-8',
    )

    expect(existsSync(join(wsRoot, 'mydata'))).toBe(false)
    const loaded = loadWorkspace(wsRoot)
    expect(loaded).not.toBeNull()
    expect(existsSync(join(wsRoot, 'mydata'))).toBe(true)
    expect(loaded?.config.defaults?.workingDirectory).toBe(join(wsRoot, 'mydata'))
    // Persisted for subsequent loads
    expect(loadWorkspaceConfig(wsRoot)?.defaults?.workingDirectory).toBe(join(wsRoot, 'mydata'))
  })

  it('ensureWorkspaceMydataDefaults does not overwrite a user-set workingDirectory', () => {
    const wsRoot = join(root, 'custom-cwd-ws')
    mkdirSync(wsRoot, { recursive: true })
    const customCwd = join(wsRoot, 'src')
    mkdirSync(customCwd, { recursive: true })
    writeFileSync(
      join(wsRoot, 'config.json'),
      JSON.stringify({
        id: 'ws_custom',
        name: 'Custom',
        slug: 'custom-cwd-ws',
        defaults: { workingDirectory: customCwd },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      'utf-8',
    )

    ensureWorkspaceMydataDefaults(wsRoot)
    expect(existsSync(join(wsRoot, 'mydata'))).toBe(true)
    expect(loadWorkspaceConfig(wsRoot)?.defaults?.workingDirectory).toBe(customCwd)
  })
})
