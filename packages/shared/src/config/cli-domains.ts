export type CliDomainNamespace = 'label' | 'source' | 'skill' | 'automation' | 'permission' | 'theme'

export interface CliDomainPolicy {
  namespace: CliDomainNamespace
  helpCommand: string
  workspacePathScopes: string[]
  readActions: string[]
  quickExamples: string[]
  /** Optional workspace-relative paths guarded for direct Bash operations */
  bashGuardPaths?: string[]
}

const POLICIES: Record<CliDomainNamespace, CliDomainPolicy> = {
  label: {
    namespace: 'label',
    helpCommand: 'grose-agent label --help',
    workspacePathScopes: ['labels/**'],
    readActions: ['list', 'get', 'auto-rule-list', 'auto-rule-validate'],
    quickExamples: [
      'grose-agent label list',
      'grose-agent label create --name "Bug" --color "accent"',
      'grose-agent label update bug --json \'{"name":"Bug Report"}\'',
    ],
    bashGuardPaths: ['labels/**'],
  },
  source: {
    namespace: 'source',
    helpCommand: 'grose-agent source --help',
    workspacePathScopes: ['sources/**'],
    readActions: ['list', 'get', 'validate', 'test', 'auth-help'],
    quickExamples: [
      'grose-agent source list',
      'grose-agent source get <slug>',
      'grose-agent source update <slug> --json "{...}"',
      'grose-agent source validate <slug>',
    ],
  },
  skill: {
    namespace: 'skill',
    helpCommand: 'grose-agent skill --help',
    workspacePathScopes: ['skills/**'],
    readActions: ['list', 'get', 'validate', 'where'],
    quickExamples: [
      'grose-agent skill list',
      'grose-agent skill get <slug>',
      'grose-agent skill update <slug> --json "{...}"',
      'grose-agent skill validate <slug>',
    ],
  },
  automation: {
    namespace: 'automation',
    helpCommand: 'grose-agent automation --help',
    workspacePathScopes: ['automations.json', 'automations-history.jsonl'],
    readActions: ['list', 'get', 'validate', 'history', 'last-executed', 'test', 'lint'],
    quickExamples: [
      'grose-agent automation list',
      'grose-agent automation create --event UserPromptSubmit --prompt "Summarize this prompt"',
      'grose-agent automation update <id> --json "{\"enabled\":false}"',
      'grose-agent automation history <id> --limit 20',
      'grose-agent automation validate',
    ],
    bashGuardPaths: ['automations.json', 'automations-history.jsonl'],
  },
  permission: {
    namespace: 'permission',
    helpCommand: 'grose-agent permission --help',
    workspacePathScopes: ['permissions.json', 'sources/*/permissions.json'],
    readActions: ['list', 'get', 'validate'],
    quickExamples: [
      'grose-agent permission list',
      'grose-agent permission get --source linear',
      'grose-agent permission add-mcp-pattern "list" --comment "All list ops" --source linear',
      'grose-agent permission validate',
    ],
    bashGuardPaths: ['permissions.json', 'sources/*/permissions.json'],
  },
  theme: {
    namespace: 'theme',
    helpCommand: 'grose-agent theme --help',
    workspacePathScopes: ['config.json', 'theme.json', 'themes/*.json'],
    readActions: ['get', 'validate', 'list-presets', 'get-preset'],
    quickExamples: [
      'grose-agent theme get',
      'grose-agent theme list-presets',
      'grose-agent theme set-color-theme nord',
      'grose-agent theme set-workspace-color-theme default',
      'grose-agent theme set-override --json "{\"accent\":\"#3b82f6\"}"',
    ],
    bashGuardPaths: ['config.json', 'theme.json', 'themes/*.json'],
  },
}

export const CLI_DOMAIN_POLICIES = POLICIES

export interface CliDomainScopeEntry {
  namespace: CliDomainNamespace
  scope: string
}

function dedupeScopes(scopes: string[]): string[] {
  return [...new Set(scopes)]
}

/**
 * Canonical workspace-relative path scopes owned by grose-agent CLI domains.
 * Use these for file-path ownership checks to avoid drift across call sites.
 */
export const GROSE_AGENTS_CLI_OWNED_WORKSPACE_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.workspacePathScopes)
)

/**
 * Canonical workspace-relative path scopes guarded for direct Bash operations.
 */
export const GROSE_AGENTS_CLI_OWNED_BASH_GUARD_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.bashGuardPaths ?? [])
)

/**
 * Namespace-aware workspace scope entries for grose-agent CLI owned paths.
 */
export const GROSE_AGENTS_CLI_WORKSPACE_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => policy.workspacePathScopes.map(scope => ({ namespace: policy.namespace, scope })))

/**
 * Namespace-aware Bash guard scope entries.
 */
export const GROSE_AGENTS_CLI_BASH_GUARD_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => (policy.bashGuardPaths ?? []).map(scope => ({ namespace: policy.namespace, scope })))

export interface BashPatternRule {
  pattern: string
  comment: string
}

/**
 * Derive the canonical Explore-mode read-only grose-agent bash patterns from
 * CLI domain policies. Keeps permissions regexes aligned with command metadata.
 */
export function getGroseAgentReadOnlyBashPatterns(): BashPatternRule[] {
  const namespaces = Object.keys(POLICIES) as CliDomainNamespace[]
  const namespaceAlternation = namespaces.join('|')

  const rules: BashPatternRule[] = namespaces.map((namespace) => {
    const policy = POLICIES[namespace]
    const actions = policy.readActions.join('|')
    return {
      pattern: `^grose-agent\\s+${namespace}\\s+(${actions})\\b`,
      comment: `grose-agent ${namespace} read-only operations`,
    }
  })

  rules.push(
    { pattern: '^grose-agent\\s*$', comment: 'grose-agent bare invocation (prints help)' },
    { pattern: `^grose-agent\\s+(${namespaceAlternation})\\s*$`, comment: 'grose-agent entity help' },
    { pattern: `^grose-agent\\s+(${namespaceAlternation})\\s+--help\\b`, comment: 'grose-agent entity help flags' },
    { pattern: '^grose-agent\\s+--(help|version|discover)\\b', comment: 'grose-agent global flags' },
  )

  return rules
}

export function getCliDomainPolicy(namespace: CliDomainNamespace): CliDomainPolicy {
  return POLICIES[namespace]
}
