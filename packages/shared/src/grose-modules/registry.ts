/**
 * Declarative registry of Grose builtin workbench modules for prefer-builtin
 * agent routing. See docs/grose-modules-agent-routing.md.
 */

import { GROSE_MODULES_SOURCE_SLUG } from './mcp-source.ts'

/** Known builtin module ids; open string union for future modules. */
export type GroseBuiltinModuleId = 'rss' | 'knowledge' | 'workflows' | 'sites' | (string & {})

export type GroseBuiltinModule = {
  id: GroseBuiltinModuleId
  title: string
  /** Natural-language intent cues for the prompt catalog */
  intents: string[]
  /** MCP tool name prefix on source slug grose-modules */
  toolPrefix: string
  /** Optional deep-workflow skill (Phase 2) */
  skillSlug?: string
  preferBuiltin: true
  /** Whether the module is shipped/ready for prefer-builtin routing */
  enabled: boolean
}

export type FormatGroseModulesContextOptions = {
  /** Workbench ActivityBar module id when known (e.g. rss, knowledge, workflows) */
  activeModuleId?: string | null
  /**
   * Canonical Grose workspace id (global registry / UI activeWorkspaceId).
   * Agents must pass this as workspace_id on grose-modules MCP tools.
   */
  workspaceId?: string | null
  /**
   * When true, omit the Active workbench module line (stable catalog only).
   * Used so PromptBuilder can put the active line in volatile context.
   */
  omitActiveLine?: boolean
}

const GROSE_BUILTIN_MODULES: readonly GroseBuiltinModule[] = [
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
    // No kb_* MCP tools in grose-modules yet
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
    // wf_* tools exist on grose-modules MCP (stub run)
    enabled: true,
  },
  {
    id: 'sites',
    title: 'Sites',
    intents: [
      'create a site',
      'list sites',
      'preview a site',
      'edit site files',
      'build a landing page',
      'scaffold a website',
      'visual edit a site',
    ],
    toolPrefix: 'sites_',
    preferBuiltin: true,
    enabled: true,
  },
]

export function listGroseBuiltinModules(): readonly GroseBuiltinModule[] {
  return GROSE_BUILTIN_MODULES
}

export function getGroseBuiltinModule(
  id: string,
): GroseBuiltinModule | undefined {
  return GROSE_BUILTIN_MODULES.find((m) => m.id === id)
}

/**
 * Format the `<grose_modules>` policy + catalog block for PromptBuilder.
 */
export function formatGroseModulesContextBlock(
  opts?: FormatGroseModulesContextOptions,
): string {
  const lines: string[] = [
    'Prefer builtin Grose modules over creating new API/MCP Sources when user intent matches.',
    '',
    `Source slug: ${GROSE_MODULES_SOURCE_SLUG}`,
    'Rules:',
    `- When intent matches an enabled module below, call tools on ${GROSE_MODULES_SOURCE_SLUG} (prefixes listed).`,
    '- Do NOT create new API or MCP Sources for RSS, Knowledge, Workflows, or Sites when grose-modules covers the need.',
    '- Optional skills (if listed) are for deep multi-step workflows only; still require grose-modules.',
    '- Always pass workspace_id from this block (never invent ids or read a different config.json id).',
    '- Module data lives under the workspace folder (rootPath/modules/…), not ~/.grose-agent/tables or workspaces/{uuid}/modules.',
    '- Before claiming feeds/workflows/sites "already added", call the list tool (rss_list_feeds / wf_list / sites_list) for this workspace_id.',
    '',
    'Modules:',
  ]

  for (const mod of GROSE_BUILTIN_MODULES) {
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
      `Pass workspace_id: "${workspaceId}" on every rss_*/wf_*/kb_*/sites_* tool call (matches Workbench UI).`,
    )
  }

  if (!opts?.omitActiveLine) {
    const active = opts?.activeModuleId?.trim()
    if (active) {
      lines.push('')
      lines.push(`Active workbench module: ${active}`)
    }
  }

  return `<grose_modules>\n${lines.join('\n')}\n</grose_modules>`
}

/** Volatile one-liner when workbench active module is known. */
export function formatGroseModulesActiveLine(
  activeModuleId?: string | null,
): string | null {
  const active = activeModuleId?.trim()
  if (!active) return null
  return `<grose_modules_active>\nActive workbench module: ${active}\n</grose_modules_active>`
}
