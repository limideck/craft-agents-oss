import { useAtomValue } from 'jotai'
import { focusedSessionIdAtom } from '@/atoms/panel-stack'
import { useNavigationState, isSessionsNavigation } from '@/contexts/NavigationContext'
import ChatPage from '@/pages/ChatPage'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'

/**
 * Center chat panel — wraps existing Craft ChatPage.
 * Session id from panel params, else nav details, else focused panel atom.
 */
export function ChatPanel({ params }: { params: Record<string, unknown> }) {
  const navState = useNavigationState()
  const focusedId = useAtomValue(focusedSessionIdAtom)

  const paramId = typeof params.sessionId === 'string' ? params.sessionId : null
  const navId =
    isSessionsNavigation(navState) && navState.details?.sessionId
      ? navState.details.sessionId
      : null
  const sessionId = paramId ?? navId ?? focusedId

  if (!sessionId) {
    return (
      <PanelRoot>
        <PanelHeaderBar>
          <span className="font-medium truncate">Agent</span>
        </PanelHeaderBar>
        <PanelBody className="flex items-center justify-center text-muted-foreground text-sm">
          Select a session from the list, or create a new agent.
        </PanelBody>
      </PanelRoot>
    )
  }

  return (
    <PanelRoot>
      <PanelBody padding={false} scroll={false} className="flex flex-col">
        <ChatPage sessionId={sessionId} />
      </PanelBody>
    </PanelRoot>
  )
}
