/**
 * Declarative registry of Craft builtin workbench modules for prefer-builtin
 * agent routing. See docs/craft-modules-agent-routing.md.
 */

import { CRAFT_MODULES_SOURCE_SLUG } from './mcp-source.ts'

/** Known builtin module ids; open string union for future modules. */
export type CraftBuiltinModuleId = 'rss' | 'knowledge' | 'workflows' | (string & {})

export type CraftBuiltinModule = {
  id: CraftBuiltinModuleId
  title: string
  /** Natural-language intent cues for the prompt catalog */
  intents: string[]
  /** MCP tool name prefix on source slug craft-modules */
  toolPrefix: string
  /** Optional deep-workflow skill (Phase 2) */
  skillSlug?: string
  preferBuiltin: true
  /** Whether the module is shipped/ready for prefer-builtin routing */
  enabled: boolean
}

export type FormatCraftModulesContextOptions = {
  /** Workbench ActivityBar module id when known (e.g. rss, knowledge, workflows) */
  activeModuleId?: string | null
  /**
   * Canonical Craft workspace id (global registry / UI activeWorkspaceId).
   * Agents must pass this as workspace_id on craft-modules MCP tools.
   */
  workspaceId?: string | null
  /**
   * When true, omit the Active workbench module line (stable catalog only).
   * Used so PromptBuilder can put the active line in volatile context.
   */
  omitActiveLine?: boolean
}

const CRAFT_BUILTIN_MODULES: readonly CraftBuiltinModule[] = [
  {
    id: 'rss',
    title: 'RSS',
    intents: [
      'subscribe to feeds',
      'list feeds',
      'refresh feeds',
      'read articles',
      'star or unstar articles',
      'import OPML',
      'export OPML',
      'fetch full article text',
      'manage RSS subscriptions',
    ],
    toolPrefix: 'rss_',
    preferBuiltin: true,
    enabled: true,
  },
  {
    id: 'knowledge',
    title: 'Knowledge',
    intents: [
      'search the knowledge base',
      'index documents',
      'retrieve saved notes or docs',
      'manage knowledge base entries',
    ],
    toolPrefix: 'kb_',
    preferBuiltin: true,
    // No kb_* MCP tools in craft-modules yet
    enabled: false,
  },
  {
    id: 'workflows',
    title: 'Workflows',
    intents: [
      'list workflows',
      'create or update a workflow',
      'run a workflow',
      'inspect workflow runs',
      'delete a workflow',
    ],
    toolPrefix: 'wf_',
    preferBuiltin: true,
    // wf_* tools exist on craft-modules MCP (stub run)
    enabled: true,
  },
]

export function listCraftBuiltinModules(): readonly CraftBuiltinModule[] {
  return CRAFT_BUILTIN_MODULES
}

export function getCraftBuiltinModule(
  id: string,
): CraftBuiltinModule | undefined {
  return CRAFT_BUILTIN_MODULES.find((m) => m.id === id)
}

/**
 * Format the `<craft_modules>` policy + catalog block for PromptBuilder.
 */
export function formatCraftModulesContextBlock(
  opts?: FormatCraftModulesContextOptions,
): string {
  const lines: string[] = [
    'Prefer builtin Craft modules over creating new API/MCP Sources when user intent matches.',
    '',
    `Source slug: ${CRAFT_MODULES_SOURCE_SLUG}`,
    'Rules:',
    `- When intent matches an enabled module below, call tools on ${CRAFT_MODULES_SOURCE_SLUG} (prefixes listed).`,
    '- Do NOT create new API or MCP Sources for RSS, Knowledge, or Workflows when craft-modules covers the need.',
    '- Optional skills (if listed) are for deep multi-step workflows only; still require craft-modules.',
    '- Always pass workspace_id from this block (never invent ids or read a different config.json id).',
    '- Module data lives under the workspace folder (rootPath/modules/…), not ~/.craft-agent/tables or workspaces/{uuid}/modules.',
    '- Before claiming feeds/workflows "already added", call the list tool (rss_list_feeds / wf_list) for this workspace_id.',
    '',
    'Modules:',
  ]

  for (const mod of CRAFT_BUILTIN_MODULES) {
    const status = mod.enabled ? 'enabled' : 'disabled'
    const skill = mod.skillSlug ? ` — skill: ${mod.skillSlug}` : ''
    const intents = mod.intents.join(', ')
    lines.push(
      `- ${mod.id} (${status}): ${mod.title} — tools ${mod.toolPrefix}*${skill} — intents: ${intents}`,
    )
  }

  const workspaceId = opts?.workspaceId?.trim()
  if (workspaceId) {
    lines.push('')
    lines.push(`workspace_id: ${workspaceId}`)
    lines.push(
      `Pass workspace_id: "${workspaceId}" on every rss_*/wf_*/kb_* tool call (matches Workbench UI).`,
    )
  }

  if (!opts?.omitActiveLine) {
    const active = opts?.activeModuleId?.trim()
    if (active) {
      lines.push('')
      lines.push(`Active workbench module: ${active}`)
    }
  }

  return `<craft_modules>\n${lines.join('\n')}\n</craft_modules>`
}

/** Volatile one-liner when workbench active module is known. */
export function formatCraftModulesActiveLine(
  activeModuleId?: string | null,
): string | null {
  const active = activeModuleId?.trim()
  if (!active) return null
  return `<craft_modules_active>\nActive workbench module: ${active}\n</craft_modules_active>`
}
