import { useCallback } from 'react'
import { getDefaultStore, useAtomValue, useSetAtom, useStore } from 'jotai'
import { useAppShellContext } from '@/context/AppShellContext'
import { focusOrAddPanel } from '../dock/layout-manager'
import { activeModuleIdAtom, dockviewApiAtom } from '../store/workbench-store'
import { resolveSeedPrompt, titleFromContext } from './seed-prompt'
import type { OpenAgentChatOptions, OpenAgentChatResult } from './types'

const CHAT_PANEL_ID = 'chat'
const CHAT_COMPONENT = 'chat'

type JotaiStore = ReturnType<typeof getDefaultStore>

/**
 * Open (or focus) the shared Chat dock panel in the **current** module layout.
 * Does not switch ActivityBar to Agents unless `focusAgentsModule` is set.
 */
export async function openAgentChat(
  options: OpenAgentChatOptions & {
    workspaceId: string
    createSession: (workspaceId: string) => Promise<{ id: string }>
    onInputChange?: (sessionId: string, value: string) => void
    setActiveModuleId?: (id: string) => void
    activeModuleId?: string
    /** Prefer the React tree store (from useStore). Falls back to getDefaultStore(). */
    store?: JotaiStore
  },
): Promise<OpenAgentChatResult | null> {
  const store = options.store ?? getDefaultStore()
  const {
    workspaceId,
    createSession,
    onInputChange,
    setActiveModuleId,
    sessionId: existingSessionId,
    seedPrompt,
    context,
    placement,
    title,
    focusAgentsModule,
  } = options

  const activeModuleId =
    options.activeModuleId ?? store.get(activeModuleIdAtom)

  if (focusAgentsModule && setActiveModuleId && activeModuleId !== 'agents') {
    setActiveModuleId('agents')
  }

  let sessionId = existingSessionId
  if (!sessionId) {
    const session = await createSession(workspaceId)
    sessionId = session.id
  }

  const api = store.get(dockviewApiAtom)
  if (!api) {
    console.warn('[openAgentChat] dockview API not ready')
    return { sessionId, activeModuleId }
  }

  const panelTitle = title ?? titleFromContext(context, 'Chat')
  const resolvedPlacement =
    placement ??
    (store.get(activeModuleIdAtom) === 'agents' ? 'active-group' : 'right')

  try {
    focusOrAddPanel(api, {
      id: CHAT_PANEL_ID,
      component: CHAT_COMPONENT,
      title: panelTitle,
      params: {
        sessionId,
        ...(context ? { context } : {}),
        ...(activeModuleId ? { activeModuleId } : {}),
      },
      placement: resolvedPlacement,
    })
  } catch (err) {
    console.error('[openAgentChat] focusOrAddPanel failed', err)
    return { sessionId, activeModuleId }
  }

  const seed = resolveSeedPrompt(seedPrompt, context)
  if (seed && onInputChange) {
    setTimeout(() => onInputChange(sessionId!, seed), 100)
  }

  return { sessionId, activeModuleId }
}

/** React hook — preferred entry for TopBar / module UI. */
export function useOpenAgentChat() {
  const { onCreateSession, onInputChange, activeWorkspaceId } = useAppShellContext()
  const activeModuleId = useAtomValue(activeModuleIdAtom)
  const setActiveModuleId = useSetAtom(activeModuleIdAtom)
  const store = useStore()

  return useCallback(
    async (options: OpenAgentChatOptions = {}): Promise<OpenAgentChatResult | null> => {
      if (!activeWorkspaceId) {
        console.warn('[openAgentChat] no workspace selected')
        return null
      }
      return openAgentChat({
        ...options,
        workspaceId: activeWorkspaceId,
        createSession: onCreateSession,
        onInputChange,
        setActiveModuleId,
        activeModuleId,
        store,
      })
    },
    [activeWorkspaceId, onCreateSession, onInputChange, setActiveModuleId, activeModuleId, store],
  )
}
