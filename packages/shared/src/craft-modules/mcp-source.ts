/**
 * Idempotently ensure a craft-modules HTTP MCP source exists in a workspace.
 */

import {
  createSource,
  loadSource,
  loadSourceConfig,
  markSourceAuthenticated,
  saveSourceConfig,
} from '../sources/storage.ts'
import { getSourceCredentialManager } from '../sources/credential-manager.ts'

export const CRAFT_MODULES_SOURCE_SLUG = 'craft-modules'
export const CRAFT_MODULES_SOURCE_NAME = 'Craft Modules'
export const CRAFT_MODULES_PROVIDER = 'craft-modules'
/** Shown in <sources> when the source is first introduced this session */
export const CRAFT_MODULES_TAGLINE =
  'Preferred builtin for RSS, Knowledge, and Workflows (rss_*/kb_*/wf_* tools)'

export interface EnsureCraftModulesSourceInput {
  workspaceRootPath: string
  baseUrl: string
  token: string
}

export interface EnsureCraftModulesSourceResult {
  slug: string
  created: boolean
  updated: boolean
  mcpUrl: string
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

  const credManager = getSourceCredentialManager()
  const existingCred = await credManager.load(source)
  if (existingCred?.value !== input.token) {
    await credManager.save(source, { value: input.token })
    updated = true
  }
  markSourceAuthenticated(input.workspaceRootPath, CRAFT_MODULES_SOURCE_SLUG)

  return {
    slug: CRAFT_MODULES_SOURCE_SLUG,
    created,
    updated,
    mcpUrl,
  }
}
