import type { AgentChatContext } from './types'

/** Build a composer seed from structured context when no explicit seedPrompt is given. */
export function buildSeedFromContext(context?: AgentChatContext): string | undefined {
  if (!context || context.type === 'plain') return undefined

  switch (context.type) {
    case 'rss-article': {
      const title = context.title ? `"${context.title}"` : 'this article'
      const feed = context.feedTitle ? ` (from ${context.feedTitle})` : ''
      const url = context.url ? `\n\nSource: ${context.url}` : ''
      return `Help me understand ${title}${feed}.${url}`
    }
    case 'kb-doc': {
      const title = context.title ? `"${context.title}"` : 'this document'
      return `Help me with ${title} from the knowledge base.`
    }
    case 'workflow': {
      const title = context.title ? `"${context.title}"` : 'this workflow'
      return `Help me with ${title}.`
    }
    case 'selection': {
      const source = context.source ? ` (from ${context.source})` : ''
      return `Regarding the following selection${source}:\n\n${context.text}`
    }
    default:
      return undefined
  }
}

export function titleFromContext(context?: AgentChatContext, fallback = 'Chat'): string {
  if (!context || context.type === 'plain') return fallback
  switch (context.type) {
    case 'rss-article':
      return context.title ? `Ask: ${context.title}` : 'Ask AI'
    case 'kb-doc':
      return context.title ? `Ask: ${context.title}` : 'Ask AI'
    case 'workflow':
      return context.title ? `Ask: ${context.title}` : 'Ask AI'
    case 'selection':
      return 'Ask AI'
    default:
      return fallback
  }
}

export function resolveSeedPrompt(
  seedPrompt?: string,
  context?: AgentChatContext,
): string | undefined {
  if (seedPrompt && seedPrompt.trim()) return seedPrompt
  return buildSeedFromContext(context)
}
