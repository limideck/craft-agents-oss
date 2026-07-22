import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Eye, X } from 'lucide-react'
import { focusedSessionIdAtom } from '@/atoms/panel-stack'
import { useNavigationState, isSessionsNavigation } from '@/contexts/NavigationContext'
import ChatPage from '@/pages/ChatPage'
import { Button } from '@/components/ui/button'
import { PanelRightRounded } from '@/components/icons/PanelRightRounded'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { useCloseAgentChat } from '../../../chat'
import { activeModuleIdAtom } from '../../../store/workbench-store'
import { useLastPreviewPath, useReopenFilePreview } from '../open-file-editor'
import { useAgentsRightToolsOpen, useOpenAgentsRightTools } from '../open-agents-tools'

/**
 * Center chat panel — wraps existing Grose ChatPage.
 * Session id from panel params, else nav details, else focused panel atom.
 * Outside Agents, show an explicit close so the docked AI sidebar can be dismissed.
 * When a last preview path exists, show a 预览 entry on the empty-state / docked header.
 * When Agents right tools are closed, show a persistent reopen control.
 */
export function ChatPanel({ params }: { params: Record<string, unknown> }) {
  const { t } = useTranslation()
  const navState = useNavigationState()
  const focusedId = useAtomValue(focusedSessionIdAtom)
  const activeModuleId = useAtomValue(activeModuleIdAtom)
  const closeChat = useCloseAgentChat()
  const lastPreviewPath = useLastPreviewPath()
  const reopenPreview = useReopenFilePreview()
  const toolsOpen = useAgentsRightToolsOpen()
  const openTools = useOpenAgentsRightTools()

  const paramId = typeof params.sessionId === 'string' ? params.sessionId : null
  const navId =
    isSessionsNavigation(navState) && navState.details?.sessionId
      ? navState.details.sessionId
      : null
  const sessionId = paramId ?? navId ?? focusedId
  const showClose = activeModuleId !== 'agents'
  const showPreviewEntry = !!lastPreviewPath
  const showToolsReopen = activeModuleId === 'agents' && !toolsOpen
  const previewName = lastPreviewPath
    ? (lastPreviewPath.split(/[/\\]/).pop() ?? lastPreviewPath)
    : null

  const toolsButton = showToolsReopen ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      title={t('workbench.agents.showTools')}
      aria-label={t('workbench.agents.showTools')}
      onClick={() => openTools()}
    >
      <PanelRightRounded className="h-3.5 w-3.5" />
    </Button>
  ) : null

  const previewButton = showPreviewEntry ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      title={`预览：${previewName}`}
      onClick={() => reopenPreview()}
    >
      <Eye className="h-3.5 w-3.5" />
    </Button>
  ) : null

  if (!sessionId) {
    return (
      <PanelRoot>
        <PanelHeaderBar className="justify-between">
          <span className="font-medium truncate">Agent</span>
          <div className="flex items-center gap-0.5">
            {toolsButton}
            {previewButton}
            {showClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="关闭"
                onClick={() => closeChat()}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </PanelHeaderBar>
        <PanelBody className="flex items-center justify-center text-muted-foreground text-sm">
          从列表选择会话，或新建 Agent。
        </PanelBody>
      </PanelRoot>
    )
  }

  return (
    <PanelRoot>
      {showClose ? (
        <PanelHeaderBar className="justify-between">
          <span className="font-medium truncate">AI Chat</span>
          <div className="flex items-center gap-0.5">
            {toolsButton}
            {previewButton}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="关闭侧边栏"
              onClick={() => closeChat()}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </PanelHeaderBar>
      ) : null}
      <PanelBody padding={false} scroll={false} className="flex flex-col min-h-0 flex-1">
        <ChatPage sessionId={sessionId} rightSidebarButton={toolsButton} />
      </PanelBody>
    </PanelRoot>
  )
}
