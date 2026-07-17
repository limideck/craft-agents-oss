/**
 * Idempotently ensure a craft-modules HTTP MCP source exists in a workspace.
 *
 * Also adds the slug to workspace `defaults.enabledSourceSlugs` so new sessions
 * auto-activate it (prefer-builtin — see docs/craft-modules-agent-routing.md).
 */

import {
  createSource,
  loadSource,
  loadSourceConfig,
  loadSourceGuide,
  markSourceAuthenticated,
  saveSourceConfig,
  saveSourceGuide,
} from '../sources/storage.ts'
import { getSourceCredentialManager } from '../sources/credential-manager.ts'
import { loadWorkspaceConfig, saveWorkspaceConfig } from '../workspaces/storage.ts'

export const CRAFT_MODULES_SOURCE_SLUG = 'craft-modules'
export const CRAFT_MODULES_SOURCE_NAME = 'Craft Modules'
export const CRAFT_MODULES_PROVIDER = 'craft-modules'
/** Shown in <sources> when the source is first introduced this session */
export const CRAFT_MODULES_TAGLINE =
  'Preferred builtin for RSS, Knowledge, and Workflows (rss_*/kb_*/wf_* tools)'

const CRAFT_MODULES_GUIDE = `# craft-modules

## Guidelines

- Prefer these tools for RSS, Knowledge, and Workflows instead of creating new Sources.
- Pass \`workspace_id\` from the session \`<craft_modules>\` block (same id as the Workbench UI).
- Do **not** invent a workspace id or copy \`id\` from a different workspace folder's \`config.json\` if it disagrees with \`<craft_modules>\`.
- Persistence is under the workspace disk root (\`rootPath/modules/…\`). Do not invent paths under \`~/.craft-agent/tables\` or \`workspaces/{uuid}/modules\`.
- Before claiming feeds are "already added", call \`rss_list_feeds\` for that workspace_id.

## Context

Builtin MCP for Craft workbench modules (\`rss_*\`, \`kb_*\`, \`wf_*\`).
`

export interface EnsureCraftModulesSourceInput {
  workspaceRootPath: string
  baseUrl: string
  token: string
}

export interface EnsureCraftModulesSourceResult {
  slug: string
  created: boolean
  updated: boolean
  /** True when craft-modules was added to workspace defaults.enabledSourceSlugs */
  defaultsUpdated: boolean
  mcpUrl: string
}

/**
 * Ensure craft-modules is in workspace session defaults so new sessions
 * include it in enabledSourceSlugs without a manual Sources toggle.
 */
export function ensureCraftModulesInWorkspaceDefaults(workspaceRootPath: string): boolean {
  const config = loadWorkspaceConfig(workspaceRootPath)
  if (!config) return false

  const slugs = config.defaults?.enabledSourceSlugs ?? []
  if (slugs.includes(CRAFT_MODULES_SOURCE_SLUG)) return false

  config.defaults = {
    ...config.defaults,
    enabledSourceSlugs: [...slugs, CRAFT_MODULES_SOURCE_SLUG],
  }
  saveWorkspaceConfig(workspaceRootPath, config)
  return true
}

function mcpUrlFor(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/mcp`
}

export async function ensureCraftModulesMcpSource(
  input: EnsureCraftModulesSourceInput,
): Promise<EnsureCraftModulesSourceResult> {
  const mcpUrl = mcpUrlFor(input.baseUrl)
  const existing = loadSource(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG)
  let created = false
  let updated = false

  if (!existing) {
    await createSource(input.workspaceRootPath, {
      name: CRAFT_MODULES_SOURCE_SLUG,
      provider: CRAFT_MODULES_PROVIDER,
      type: 'mcp',
      enabled: true,
      mcp: {
        transport: 'http',
        url: mcpUrl,
        authType: 'bearer',
      },
    })
    const createdConfig = loadSourceConfig(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG)
    if (createdConfig) {
      createdConfig.name = CRAFT_MODULES_SOURCE_NAME
      createdConfig.tagline = CRAFT_MODULES_TAGLINE
      saveSourceConfig(input.workspaceRootPath, createdConfig)
    }
    created = true
  } else {
    const config = loadSourceConfig(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG)
    if (config) {
      const needsUpdate =
        config.mcp?.url !== mcpUrl ||
        config.mcp?.transport !== 'http' ||
        config.mcp?.authType !== 'bearer' ||
        config.provider !== CRAFT_MODULES_PROVIDER ||
        config.type !== 'mcp'

      if (needsUpdate) {
        config.mcp = {
          ...config.mcp,
          transport: 'http',
          url: mcpUrl,
          authType: 'bearer',
        }
        config.provider = CRAFT_MODULES_PROVIDER
        config.type = 'mcp'
        config.updatedAt = Date.now()
        saveSourceConfig(input.workspaceRootPath, config)
        updated = true
      }
      if (config.tagline !== CRAFT_MODULES_TAGLINE || config.name !== CRAFT_MODULES_SOURCE_NAME) {
        config.name = CRAFT_MODULES_SOURCE_NAME
        config.tagline = CRAFT_MODULES_TAGLINE
        config.updatedAt = Date.now()
        saveSourceConfig(input.workspaceRootPath, config)
        updated = true
      }
    }
  }

  const source = loadSource(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG)
  if (!source) {
    throw new Error(`Failed to load craft-modules source: ${CRAFT_MODULES_SOURCE_SLUG}`)
  }

  // Prefer-builtin: keep the Source enabled so isSourceUsable() passes.
  const cfg = loadSourceConfig(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG)
  if (cfg && !cfg.enabled) {
    cfg.enabled = true
    cfg.updatedAt = Date.now()
    saveSourceConfig(input.workspaceRootPath, cfg)
    updated = true
  }

  const credManager = getSourceCredentialManager()
  const existingCred = await credManager.load(source)
  if (existingCred?.value !== input.token) {
    await credManager.save(source, { value: input.token })
    updated = true
  }
  markSourceAuthenticated(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG)

  // Keep guide.md actionable for agents (workspace_id must match Workbench).
  const guide = loadSourceGuide(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG)
  if (
    !guide ||
    guide.raw.trim().length < 40 ||
    guide.raw.includes('(Add usage guidelines here)')
  ) {
    saveSourceGuide(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG, {
      raw: CRAFT_MODULES_GUIDE,
    })
    updated = true
  }

  const defaultsUpdated = ensureCraftModulesInWorkspaceDefaults(input.workspaceRootPath)

  return {
    slug: CRAFT_MODULES_SOURCE_SLUG,
    created,
    updated,
    defaultsUpdated,
    mcpUrl,
  }
}
