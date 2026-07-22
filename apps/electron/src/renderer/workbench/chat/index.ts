export type { AgentChatContext, AgentChatPlacement, OpenAgentChatOptions, OpenAgentChatResult } from './types'
export {
  CHAT_PANEL_ID,
  openAgentChat,
  closeAgentChat,
  isAgentChatOpen,
  useOpenAgentChat,
  useCloseAgentChat,
} from './open-agent-chat'
export { buildSeedFromContext, titleFromContext, resolveSeedPrompt } from './seed-prompt'
