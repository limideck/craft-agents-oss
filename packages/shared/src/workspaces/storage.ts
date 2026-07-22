/**
 * Workspace Storage
 *
 * CRUD operations for workspaces.
 * Workspaces can be stored anywhere on disk via rootPath.
 * Default location: ~/.grose-agent/workspaces/
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { expandPath, toPortablePath } from '../utils/paths.ts';
import { atomicWriteFileSync, readJsonFileSync } from '../utils/files.ts';
import { getDefaultStatusConfig, saveStatusConfig, ensureDefaultIconFiles } from '../statuses/storage.ts';
import { getDefaultLabelConfig, saveLabelConfig } from '../labels/storage.ts';
import { loadConfigDefaults } from '../config/storage.ts';
import { parsePermissionMode, PERMISSION_MODE_ORDER } from '../agent/mode-types.ts';
import { normalizeThinkingLevel } from '../agent/thinking-levels.ts';
import type {
  WorkspaceConfig,
  CreateWorkspaceInput,
  LoadedWorkspace,
  WorkspaceSummary,
} from './types.ts';

const CONFIG_DIR = join(homedir(), '.grose-agent');
const DEFAULT_WORKSPACES_DIR = join(CONFIG_DIR, 'workspaces');

// ============================================================
// Path Utilities
// ============================================================

/**
 * Get the default workspaces directory (~/.grose-agent/workspaces/)
 */
export function getDefaultWorkspacesDir(): string {
  return DEFAULT_WORKSPACES_DIR;
}

/**
 * Ensure default workspaces directory exists
 */
export function ensureDefaultWorkspacesDir(): void {
  if (!existsSync(DEFAULT_WORKSPACES_DIR)) {
    mkdirSync(DEFAULT_WORKSPACES_DIR, { recursive: true });
  }
}

/**
 * Get workspace root path from ID
 * @param workspaceId - Workspace ID
 * @returns Absolute path to workspace root in default location
 */
export function getWorkspacePath(workspaceId: string): string {
  return join(DEFAULT_WORKSPACES_DIR, workspaceId);
}

/**
 * Get path to workspace sources directory
 * @param rootPath - Absolute path to workspace root folder
 */
export function getWorkspaceSourcesPath(rootPath: string): string {
  return join(rootPath, 'sources');
}

/**
 * Get path to workspace sessions directory
 * @param rootPath - Absolute path to workspace root folder
 */
export function getWorkspaceSessionsPath(rootPath: string): string {
  return join(rootPath, 'sessions');
}

/**
 * Get path to workspace skills directory
 * @param rootPath - Absolute path to workspace root folder
 */
export function getWorkspaceSkillsPath(rootPath: string): string {
  return join(rootPath, 'skills');
}

/** Persistent AI deliverables directory under `{rootPath}/mydata`. */
export const WORKSPACE_MYDATA_DIR = 'mydata';

/**
 * Get path to workspace mydata directory (persistent agent deliverables).
 * @param rootPath - Absolute path to workspace root folder
 */
export function getWorkspaceMydataPath(rootPath: string): string {
  return join(rootPath, WORKSPACE_MYDATA_DIR);
}

/**
 * Ensure `{rootPath}/mydata` exists. Safe to call repeatedly (mkdir -p).
 */
export function ensureWorkspaceMydataDir(rootPath: string): void {
  mkdirSync(getWorkspaceMydataPath(rootPath), { recursive: true });
}

/**
 * Ensure `mydata/` exists and backfill `defaults.workingDirectory` → mydata
 * when the workspace has no configured working directory yet.
 *
 * Does not overwrite a user-set (or previously defaulted) workingDirectory.
 * Safe to call repeatedly.
 */
export function ensureWorkspaceMydataDefaults(rootPath: string): void {
  ensureWorkspaceMydataDir(rootPath);

  const config = loadWorkspaceConfig(rootPath);
  if (!config) return;

  const existing = config.defaults?.workingDirectory;
  if (typeof existing === 'string' && existing.trim().length > 0) {
    return;
  }

  config.defaults = {
    ...config.defaults,
    workingDirectory: getWorkspaceMydataPath(rootPath),
  };
  saveWorkspaceConfig(rootPath, config);
}

/** Builtin workbench module ids that live under `{rootPath}/modules/`. */
export const WORKSPACE_MODULE_IDS = ['rss', 'tables', 'workflows', 'knowledge', 'sites'] as const;
export type WorkspaceModuleId = (typeof WORKSPACE_MODULE_IDS)[number];

/**
 * Get path to workspace modules directory (`{rootPath}/modules`)
 */
export function getWorkspaceModulesPath(rootPath: string): string {
  return join(rootPath, 'modules');
}

/**
 * Get path to a single module root (`{rootPath}/modules/{moduleId}`)
 */
export function getWorkspaceModulePath(rootPath: string, moduleId: WorkspaceModuleId): string {
  return join(rootPath, 'modules', moduleId);
}

/** RSS SQLite path: `{rootPath}/modules/rss/rss.db` */
export function getWorkspaceRssDbPath(rootPath: string): string {
  return join(rootPath, 'modules', 'rss', 'rss.db');
}

/** Workflows SQLite path: `{rootPath}/modules/workflows/workflows.db` */
export function getWorkspaceWorkflowsDbPath(rootPath: string): string {
  return join(rootPath, 'modules', 'workflows', 'workflows.db');
}

/** Sites module root: `{rootPath}/modules/sites` */
export function getWorkspaceSitesPath(rootPath: string): string {
  return join(rootPath, 'modules', 'sites');
}

/** Sites SQLite path: `{rootPath}/modules/sites/sites.db` */
export function getWorkspaceSitesDbPath(rootPath: string): string {
  return join(rootPath, 'modules', 'sites', 'sites.db');
}

/**
 * Preferred file SoT for workflow graph definitions (YAML/JSON).
 * Definitions may still live in workflows.db today; this path is reserved.
 */
export function getWorkspaceWorkflowsDefinitionsPath(rootPath: string): string {
  return join(rootPath, 'modules', 'workflows', 'definitions');
}

/** Tables (plydb) data dir: `{rootPath}/modules/tables` */
export function getWorkspaceTablesDataPath(rootPath: string): string {
  return join(rootPath, 'modules', 'tables');
}

/**
 * Ensure empty module directory tree under `{rootPath}/modules/`.
 * Safe to call repeatedly (mkdir -p).
 */
export function ensureWorkspaceModuleDirs(rootPath: string): void {
  for (const id of WORKSPACE_MODULE_IDS) {
    mkdirSync(join(rootPath, 'modules', id), { recursive: true });
  }
  // Knowledge reserved stubs (product not shipped yet)
  mkdirSync(join(rootPath, 'modules', 'knowledge', 'docs'), { recursive: true });
  mkdirSync(join(rootPath, 'modules', 'knowledge', 'index'), { recursive: true });
  mkdirSync(getWorkspaceWorkflowsDefinitionsPath(rootPath), { recursive: true });
}

// ============================================================
// Config Operations
// ============================================================

/**
 * Load workspace config.json from a workspace folder
 * @param rootPath - Absolute path to workspace root folder
 */
export function loadWorkspaceConfig(rootPath: string): WorkspaceConfig | null {
  const configPath = join(rootPath, 'config.json');
  if (!existsSync(configPath)) return null;

  try {
    const config = readJsonFileSync<WorkspaceConfig>(configPath);

    // Expand path variables in defaults for portability
    if (config.defaults?.workingDirectory) {
      config.defaults.workingDirectory = expandPath(config.defaults.workingDirectory);
    }

    // Compatibility: accept canonical or legacy permission mode names on read
    if (config.defaults?.permissionMode && typeof config.defaults.permissionMode === 'string') {
      const parsed = parsePermissionMode(config.defaults.permissionMode);
      config.defaults.permissionMode = parsed ?? undefined;
    }

    if (Array.isArray(config.defaults?.cyclablePermissionModes)) {
      const normalized = config.defaults.cyclablePermissionModes
        .map(mode => (typeof mode === 'string' ? parsePermissionMode(mode) : null))
        .filter((mode): mode is NonNullable<typeof mode> => !!mode)
        .filter((mode, index, arr) => arr.indexOf(mode) === index);

      config.defaults.cyclablePermissionModes = normalized.length >= 2
        ? normalized
        : [...PERMISSION_MODE_ORDER];
    }

    if (config.defaults && 'thinkingLevel' in config.defaults) {
      // TODO: Remove legacy 'think' normalization after old persisted workspace configs
      // have realistically aged out across upgrades.
      config.defaults.thinkingLevel = normalizeThinkingLevel(config.defaults.thinkingLevel);
    }

    return config;
  } catch {
    return null;
  }
}

/**
 * Save workspace config.json to a workspace folder
 * @param rootPath - Absolute path to workspace root folder
 */
export function saveWorkspaceConfig(rootPath: string, config: WorkspaceConfig): void {
  if (!existsSync(rootPath)) {
    mkdirSync(rootPath, { recursive: true });
  }

  // Convert paths to portable form for cross-machine compatibility
  const storageConfig: WorkspaceConfig = {
    ...config,
    updatedAt: Date.now(),
  };

  if (storageConfig.defaults?.workingDirectory) {
    storageConfig.defaults = {
      ...storageConfig.defaults,
      workingDirectory: toPortablePath(storageConfig.defaults.workingDirectory),
    };
  }

  // Use atomic write to prevent corruption on crash/interrupt
  atomicWriteFileSync(join(rootPath, 'config.json'), JSON.stringify(storageConfig, null, 2));
}

// ============================================================
// Load Operations
// ============================================================

/**
 * Count subdirectories in a path
 */
function countSubdirs(dirPath: string): number {
  if (!existsSync(dirPath)) return 0;
  try {
    return readdirSync(dirPath, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  } catch {
    return 0;
  }
}

/**
 * List subdirectory names in a path
 */
function listSubdirNames(dirPath: string): string[] {
  if (!existsSync(dirPath)) return [];
  try {
    return readdirSync(dirPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/**
 * Load workspace with summary info from a rootPath
 * @param rootPath - Absolute path to workspace root folder
 */
export function loadWorkspace(rootPath: string): LoadedWorkspace | null {
  const config = loadWorkspaceConfig(rootPath);
  if (!config) return null;

  // Ensure plugin manifest exists (migration for existing workspaces)
  ensurePluginManifest(rootPath, config.name);

  // Ensure skills directory exists (migration for existing workspaces)
  const skillsPath = getWorkspaceSkillsPath(rootPath);
  if (!existsSync(skillsPath)) {
    mkdirSync(skillsPath, { recursive: true });
  }

  // Ensure mydata/ exists and default cwd points at it (migration for existing workspaces)
  ensureWorkspaceMydataDefaults(rootPath);

  // Reload so callers see a backfilled workingDirectory when we just wrote it
  const configAfterMydata = loadWorkspaceConfig(rootPath) ?? config;

  return {
    config: configAfterMydata,
    sourceSlugs: listSubdirNames(getWorkspaceSourcesPath(rootPath)),
    sessionCount: countSubdirs(getWorkspaceSessionsPath(rootPath)),
  };
}

/**
 * Get workspace summary from a rootPath
 * @param rootPath - Absolute path to workspace root folder
 */
export function getWorkspaceSummary(rootPath: string): WorkspaceSummary | null {
  const config = loadWorkspaceConfig(rootPath);
  if (!config) return null;

  return {
    slug: config.slug,
    name: config.name,
    sourceCount: countSubdirs(getWorkspaceSourcesPath(rootPath)),
    sessionCount: countSubdirs(getWorkspaceSessionsPath(rootPath)),
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

// ============================================================
// Create/Delete Operations
// ============================================================

/**
 * Generate URL-safe slug from name
 */
export function generateSlug(name: string): string {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  if (!slug) {
    slug = 'workspace';
  }

  return slug;
}

/**
 * Generate a unique folder path for a workspace by appending a numeric suffix
 * if the slug-based folder already exists.
 * E.g., "my-workspace", "my-workspace-2", "my-workspace-3", ...
 *
 * @param name - Display name to derive the slug from
 * @param baseDir - Parent directory where workspace folders live (e.g., ~/.grose-agent/workspaces/)
 * @returns Full path to a unique, non-existing folder
 */
export function generateUniqueWorkspacePath(name: string, baseDir: string): string {
  const slug = generateSlug(name);
  let candidate = join(baseDir, slug);

  if (!existsSync(candidate)) {
    return candidate;
  }

  // Append numeric suffix until we find a non-existing path
  let counter = 2;
  while (existsSync(join(baseDir, `${slug}-${counter}`))) {
    counter++;
  }

  return join(baseDir, `${slug}-${counter}`);
}

/**
 * Create workspace folder structure at a given path
 * @param rootPath - Absolute path where workspace folder will be created
 * @param name - Display name for the workspace
 * @param defaults - Optional default settings for new sessions
 * @param id - Optional canonical workspace id (must match global registry when provided)
 * @returns The created WorkspaceConfig
 */
export function createWorkspaceAtPath(
  rootPath: string,
  name: string,
  defaults?: WorkspaceConfig['defaults'],
  id?: string,
): WorkspaceConfig {
  const now = Date.now();
  const slug = generateSlug(name);

  // Load global defaults from config-defaults.json
  const globalDefaults = loadConfigDefaults();

  // Merge global defaults with provided defaults
  // AI settings (model, thinkingLevel, defaultLlmConnection) are left undefined
  // so they fall back to app-level defaults
  const workspaceDefaults: WorkspaceConfig['defaults'] = {
    model: undefined,
    thinkingLevel: undefined,
    // defaultLlmConnection: undefined - falls back to app default
    permissionMode: globalDefaults.workspaceDefaults.permissionMode,
    cyclablePermissionModes: globalDefaults.workspaceDefaults.cyclablePermissionModes,
    enabledSourceSlugs: [],
    // Default cwd = mydata (portable form applied in saveWorkspaceConfig)
    workingDirectory: getWorkspaceMydataPath(rootPath),
    ...defaults, // User-provided defaults override global defaults
  };

  const config: WorkspaceConfig = {
    // Prefer the registry id when callers provide one so grose-modules MCP/UI share one key.
    id: id?.trim() || `ws_${randomUUID().slice(0, 8)}`,
    name,
    slug,
    defaults: workspaceDefaults,
    localMcpServers: globalDefaults.workspaceDefaults.localMcpServers,
    createdAt: now,
    updatedAt: now,
  };

  // Create workspace directory structure
  mkdirSync(rootPath, { recursive: true });
  mkdirSync(getWorkspaceSourcesPath(rootPath), { recursive: true });
  mkdirSync(getWorkspaceSessionsPath(rootPath), { recursive: true });
  mkdirSync(getWorkspaceSkillsPath(rootPath), { recursive: true });
  ensureWorkspaceMydataDir(rootPath);
  ensureWorkspaceModuleDirs(rootPath);

  // Save config
  saveWorkspaceConfig(rootPath, config);

  // Initialize status configuration with defaults
  saveStatusConfig(rootPath, getDefaultStatusConfig());
  ensureDefaultIconFiles(rootPath);

  // Initialize label configuration with defaults (two nested groups + valued labels)
  saveLabelConfig(rootPath, getDefaultLabelConfig());

  // Initialize plugin manifest for SDK integration (enables skills, commands, agents)
  ensurePluginManifest(rootPath, name);

  return config;
}

/**
 * Delete a workspace folder and all its contents
 * @param rootPath - Absolute path to workspace root folder
 */
export function deleteWorkspaceFolder(rootPath: string): boolean {
  if (!existsSync(rootPath)) return false;

  try {
    rmSync(rootPath, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a valid workspace exists at a path
 * @param rootPath - Absolute path to check
 */
export function isValidWorkspace(rootPath: string): boolean {
  return existsSync(join(rootPath, 'config.json'));
}

/**
 * Rename a workspace (updates config.json in the workspace folder)
 * @param rootPath - Absolute path to workspace root folder
 * @param newName - New display name
 */
export function renameWorkspaceFolder(rootPath: string, newName: string): boolean {
  const config = loadWorkspaceConfig(rootPath);
  if (!config) return false;

  config.name = newName.trim();
  saveWorkspaceConfig(rootPath, config);
  return true;
}

// ============================================================
// Auto-Discovery (for default workspace location)
// ============================================================

/**
 * Discover workspace folders in the default location that have valid config.json
 * Returns paths to valid workspaces found in ~/.grose-agent/workspaces/
 */
export function discoverWorkspacesInDefaultLocation(): string[] {
  const discovered: string[] = [];

  if (!existsSync(DEFAULT_WORKSPACES_DIR)) {
    return discovered;
  }

  try {
    const entries = readdirSync(DEFAULT_WORKSPACES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const rootPath = join(DEFAULT_WORKSPACES_DIR, entry.name);
      if (isValidWorkspace(rootPath)) {
        discovered.push(rootPath);
      }
    }
  } catch {
    // Ignore errors scanning directory
  }

  return discovered;
}

// ============================================================
// Workspace Color Theme
// ============================================================

/**
 * Get the color theme setting for a workspace.
 * Returns undefined if workspace uses the app default.
 *
 * @param rootPath - Absolute path to workspace root folder
 * @returns Theme ID or undefined (inherit from app default)
 */
export function getWorkspaceColorTheme(rootPath: string): string | undefined {
  const config = loadWorkspaceConfig(rootPath);
  return config?.defaults?.colorTheme;
}

/**
 * Set the color theme for a workspace.
 * Pass undefined to clear and use app default.
 *
 * @param rootPath - Absolute path to workspace root folder
 * @param themeId - Preset theme ID or undefined to inherit
 */
export function setWorkspaceColorTheme(rootPath: string, themeId: string | undefined): void {
  const config = loadWorkspaceConfig(rootPath);
  if (!config) return;

  // Validate theme ID if provided (skip for undefined = inherit default)
  // Only allow alphanumeric characters, hyphens, and underscores (max 64 chars)
  if (themeId && themeId !== 'default') {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(themeId)) {
      console.warn(`[workspace-storage] Invalid theme ID rejected: ${themeId}`);
      return;
    }
  }

  // Initialize defaults if not present
  if (!config.defaults) {
    config.defaults = {};
  }

  if (themeId) {
    config.defaults.colorTheme = themeId;
  } else {
    delete config.defaults.colorTheme;
  }

  saveWorkspaceConfig(rootPath, config);
}

// ============================================================
// Local MCP Configuration
// ============================================================

/**
 * Check if local (stdio) MCP servers are enabled for a workspace.
 * Resolution order: ENV (GROSE_LOCAL_MCP_ENABLED) > workspace config > default (true)
 *
 * @param rootPath - Absolute path to workspace root folder
 * @returns true if local MCP servers should be enabled
 */
export function isLocalMcpEnabled(rootPath: string): boolean {
  // 1. Environment variable override (highest priority)
  const envValue = process.env.GROSE_LOCAL_MCP_ENABLED;
  if (envValue !== undefined) {
    return envValue.toLowerCase() === 'true';
  }

  // 2. Workspace config
  const config = loadWorkspaceConfig(rootPath);
  if (config?.localMcpServers?.enabled !== undefined) {
    return config.localMcpServers.enabled;
  }

  // 3. Default: enabled
  return true;
}

// ============================================================
// Exports
// ============================================================

// ============================================================
// Plugin Manifest (for SDK plugin integration)
// ============================================================

/**
 * Ensure workspace has a .claude-plugin/plugin.json manifest.
 * This allows the workspace to be loaded as an SDK plugin,
 * enabling skills, commands, and agents from the workspace.
 *
 * @param rootPath - Absolute path to workspace root folder
 * @param workspaceName - Display name for the workspace (used in plugin name)
 */
export function ensurePluginManifest(rootPath: string, workspaceName: string): void {
  const pluginDir = join(rootPath, '.claude-plugin');
  const manifestPath = join(pluginDir, 'plugin.json');

  if (existsSync(manifestPath)) return;

  // Create .claude-plugin directory
  if (!existsSync(pluginDir)) {
    mkdirSync(pluginDir, { recursive: true });
  }

  // Create minimal plugin manifest
  const manifest = {
    name: `grose-workspace-${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    version: '1.0.0',
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export { CONFIG_DIR, DEFAULT_WORKSPACES_DIR };
