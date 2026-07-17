/**
 * WorkbenchTopBar — classic TopBar (workspace switcher + AppMenu) for WorkbenchShell.
 */

import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { TopBar } from '@/components/app-shell/TopBar'
import { useAppShellContext } from '@/context/AppShellContext'
import { useNavigation } from '@/contexts/NavigationContext'
import type { SettingsMenuItem } from '../../../shared/menu-schema'
import { useOpenAgentChat } from '../chat'
import { activeModuleIdAtom } from '../store/workbench-store'
import { settingsSubpageAtom } from '../modules/stock-store'

export function WorkbenchTopBar() {
  const {
    workspaces,
    activeWorkspaceId,
    onSelectWorkspace,
    onRefreshWorkspaces,
    onOpenSettings,
    onOpenKeyboardShortcuts,
    onOpenStoredUserPreferences,
  } = useAppShellContext()

  const { canGoBack, canGoForward, goBack, goForward } = useNavigation()
  const setActiveModuleId = useSetAtom(activeModuleIdAtom)
  const setSettingsSubpage = useSetAtom(settingsSubpageAtom)
  const openAgentChat = useOpenAgentChat()

  const handleOpenSettings = useCallback(() => {
    setActiveModuleId('settings')
    setSettingsSubpage('app')
    onOpenSettings()
  }, [onOpenSettings, setActiveModuleId, setSettingsSubpage])

  const handleOpenSettingsSubpage = useCallback(
    (subpage: SettingsMenuItem['id']) => {
      setActiveModuleId('settings')
      setSettingsSubpage(subpage)
    },
    [setActiveModuleId, setSettingsSubpage],
  )

  const handleNewChat = useCallback(() => {
    void openAgentChat()
  }, [openAgentChat])

  return (
    <TopBar
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      onSelectWorkspace={onSelectWorkspace}
      onWorkspaceCreated={() => onRefreshWorkspaces?.()}
      onWorkspaceRemoved={() => onRefreshWorkspaces?.()}
      onNewChat={handleNewChat}
      onNewWindow={() => window.electronAPI.menuNewWindow()}
      onOpenSettings={handleOpenSettings}
      onOpenSettingsSubpage={handleOpenSettingsSubpage}
      onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
      onOpenStoredUserPreferences={onOpenStoredUserPreferences}
      onBack={goBack}
      onForward={goForward}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onToggleSidebar={() => {
        /* ActivityBar is always visible in workbench */
      }}
      onToggleFocusMode={() => {
        /* Focus mode not wired in workbench yet */
      }}
      onAddSessionPanel={handleNewChat}
      onAddBrowserPanel={() => {
        void (async () => {
          try {
            const instanceId = await window.electronAPI.browserPane.create({ show: true })
            await window.electronAPI.browserPane.focus(instanceId)
          } catch (err) {
            console.error('[WorkbenchTopBar] Failed to create browser window:', err)
          }
        })()
      }}
    />
  )
}
