import { useMemo, useState } from 'react'
import { useAtomValue, useStore } from 'jotai'
import type { DockviewApi } from 'dockview-react'
import { Plus, Search, Archive, ArchiveRestore } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SessionList } from '@/components/sessions/SessionList'
import type { SessionMeta } from '@/atoms/sessions'
import { sessionMetaMapAtom, updateSessionMetaAtom } from '@/atoms/sessions'
import { useAppShellContext } from '@/context/AppShellContext'
import { useNavigation } from '@/contexts/NavigationContext'
import { useSessionSelection } from '@/hooks/useSession'
import * as storage from '@/lib/local-storage'
import { Button } from '@/components/ui/button'
import { useOpenAgentChat } from '../../../chat'
import { ActivityShell } from '../../../shell/ActivityShell'
import { dockviewApiAtom } from '../../../store/workbench-store'

function syncChatPanelSession(sessionId: string, api: DockviewApi | null): void {
  const chat = api?.getPanel('chat')
  if (!chat) return
  chat.api.updateParameters({ sessionId })
  chat.api.setActive()
}

/**
 * Agents module session list — full-featured wiring to the shared SessionList
 * (search, grouping, label/status filtering, archive, multi-select), backed by
 * the Grose session atoms and AppShellContext session callbacks.
 */
export function SessionListPanel() {
  const { t } = useTranslation()
  const store = useStore()
  const metaMap = useAtomValue(sessionMetaMapAtom)
  const {
    onArchiveSession,
    onUnarchiveSession,
    onRenameSession,
    onDeleteSession,
    onFlagSession,
    onUnflagSession,
    onMarkSessionUnread,
    onSessionLabelsChange,
    onSessionStatusChange,
    labels,
    sessionStatuses,
  } = useAppShellContext()
  const { navigateToSession } = useNavigation()
  const sessionSelection = useSessionSelection()
  const selectedId = sessionSelection.state.selected
  const openAgentChat = useOpenAgentChat()

  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const groupingMode = (storage.get(storage.KEYS.chatGroupingMode, 'date') as
    | 'date'
    | 'status'
    | 'unread'
    | 'project') ?? 'date'

  const items = useMemo<SessionMeta[]>(() => {
    return Array.from(metaMap.values())
      .filter((m) => (showArchived ? m.isArchived : !m.isArchived))
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
  }, [metaMap, showArchived])

  const handleSelectSession = (sessionId: string) => {
    navigateToSession(sessionId)
    syncChatPanelSession(sessionId, store.get(dockviewApiAtom))
  }

  const handleRename = (sessionId: string, name: string) => {
    onRenameSession(sessionId, name)
    // Keep meta title in sync for immediate list feedback.
    store.set(updateSessionMetaAtom, sessionId, { name })
  }

  const handleNewSession = () => {
    void openAgentChat({ focusAgentsModule: true, placement: 'active-group' })
  }

  return (
    <ActivityShell
      title={t('projectInfo.tabSessions', 'Sessions')}
      actions={
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={t('session.newSession')}
            onClick={handleNewSession}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={showArchived ? t('session.viewActive', 'View active') : t('session.viewArchived', 'View archived')}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={t('session.search', 'Search')}
            onClick={() => setSearchActive((v) => !v)}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      }
    >
      <SessionList
        items={items}
        searchActive={searchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClose={() => {
          setSearchActive(false)
          setSearchQuery('')
        }}
        groupingMode={groupingMode}
        labels={labels ?? []}
        sessionStatuses={sessionStatuses ?? []}
        onArchive={onArchiveSession}
        onUnarchive={onUnarchiveSession}
        onRename={handleRename}
        onDelete={onDeleteSession}
        onFlag={onFlagSession}
        onUnflag={onUnflagSession}
        onMarkUnread={onMarkSessionUnread}
        onSessionStatusChange={onSessionStatusChange}
        onLabelsChange={onSessionLabelsChange}
        onNavigateToSession={handleSelectSession}
        onFocusChatInput={(id) => handleSelectSession(id ?? selectedId ?? '')}
        focusedSessionId={selectedId}
      />
    </ActivityShell>
  )
}
