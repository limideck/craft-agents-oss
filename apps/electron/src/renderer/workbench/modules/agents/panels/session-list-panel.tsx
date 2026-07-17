import { useAtomValue } from 'jotai'
import { useNavigation } from '@/contexts/NavigationContext'
import { sessionMetaMapAtom } from '@/atoms/sessions'
import { getSessionTitle } from '@/utils/session'
import { useAppShellContext } from '@/context/AppShellContext'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Left-column session list — thin wiring to Craft session atoms / navigation.
 * Not a full port of AppShell SessionList (menus, filters, multi-select).
 */
export function SessionListPanel() {
  const metaMap = useAtomValue(sessionMetaMapAtom)
  const { navigateToSession } = useNavigation()
  const { onCreateSession, activeWorkspaceId } = useAppShellContext()

  const sessions = Array.from(metaMap.values())
    .filter((m) => !m.isArchived)
    .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between">
        <span className="font-medium truncate">Sessions</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="New agent"
          onClick={() => {
            if (activeWorkspaceId) void onCreateSession(activeWorkspaceId)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PanelHeaderBar>
      <PanelBody padding={false} className="p-0">
        {sessions.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No sessions yet.</div>
        ) : (
          <ul className="py-1">
            {sessions.map((meta) => (
              <li key={meta.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-foreground-5 truncate',
                    'focus-visible:outline-none focus-visible:bg-foreground-5',
                  )}
                  onClick={() => navigateToSession(meta.id)}
                >
                  {getSessionTitle(meta) || 'Untitled'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
