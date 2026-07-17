/** Context attached when opening chat from a module surface. */
export type AgentChatContext =
  | { type: 'plain' }
  | {
      type: 'rss-article'
      articleId: string
      title?: string
      feedTitle?: string
      url?: string
    }
  | { type: 'kb-doc'; docId: string; title?: string }
  | { type: 'workflow'; workflowId: string; title?: string }
  | { type: 'selection'; text: string; source?: string }

export type AgentChatPlacement = 'right' | 'left' | 'active-group'

export type OpenAgentChatOptions = {
  /** Omit to create a new session. */
  sessionId?: string
  /** Prefill the composer; overrides context-derived seed when both set. */
  seedPrompt?: string
  context?: AgentChatContext
  /** Where to dock the chat panel. Default: `right` (or `active-group` on Agents). */
  placement?: AgentChatPlacement
  title?: string
  /**
   * Switch ActivityBar to Agents before focusing chat.
   * TopBar `+` must leave this false; Agents New Session may set true.
   */
  focusAgentsModule?: boolean
}

export type OpenAgentChatResult = {
  sessionId: string
  /** Workbench module id at open time (also passed as chat panel param). */
  activeModuleId?: string
}
