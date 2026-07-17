/**
 * WorkspaceDataProvider — loads sources/skills/automations into jotai atoms for both shells.
 * WorkbenchShell mounts this so @mentions / NavigationContext stay populated
 * when AppShell is not mounted.
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation, Trans } from 'react-i18next'
import { sourcesAtom } from '@/atoms/sources'
import { skillsAtom } from '@/atoms/skills'
import { sessionMetaMapAtom } from '@/atoms/sessions'
import { focusedSessionIdAtom } from '@/atoms/panel-stack'
import { clearSourceIconCaches } from '@/lib/icon-cache'
import { useAutomations } from '@/hooks/useAutomations'
import {
  AppShellProvider,
  type AppShellContextType,
} from '@/context/AppShellContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type WorkspaceDataProviderProps = {
  contextValue: AppShellContextType
  children: React.ReactNode
}

export function WorkspaceDataProvider({
  contextValue,
  children,
}: WorkspaceDataProviderProps) {
  const { t } = useTranslation()
  const { activeWorkspaceId } = contextValue
  const setSourcesAtom = useSetAtom(sourcesAtom)
  const setSkillsAtom = useSetAtom(skillsAtom)
  const sources = useAtomValue(sourcesAtom)
  const skills = useAtomValue(skillsAtom)

  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const focusedSessionId = useAtomValue(focusedSessionIdAtom)

  const {
    automationTestResults,
    automationPendingDelete,
    pendingDeleteAutomation,
    setAutomationPendingDelete,
    handleTestAutomation,
    handleToggleAutomation,
    handleDuplicateAutomation,
    handleDeleteAutomation,
    confirmDeleteAutomation,
    getAutomationHistory,
    handleReplayAutomation,
  } = useAutomations(activeWorkspaceId)

  const activeSessionWorkingDirectory = React.useMemo(() => {
    if (!focusedSessionId) return undefined
    return sessionMetaMap.get(focusedSessionId)?.workingDirectory
  }, [focusedSessionId, sessionMetaMap])

  // Load sources when workspace changes
  React.useEffect(() => {
    if (!activeWorkspaceId) {
      setSourcesAtom([])
      return
    }
    window.electronAPI
      .getSources(activeWorkspaceId)
      .then((loaded) => setSourcesAtom(loaded || []))
      .catch((err) => {
        console.error('[WorkspaceDataProvider] Failed to load sources:', err)
      })
  }, [activeWorkspaceId, setSourcesAtom])

  // Live source updates
  React.useEffect(() => {
    const cleanup = window.electronAPI.onSourcesChanged((workspaceId, updatedSources) => {
      if (workspaceId !== activeWorkspaceId) return
      clearSourceIconCaches()
      setSourcesAtom(updatedSources || [])
    })
    return cleanup
  }, [activeWorkspaceId, setSourcesAtom])

  // Load skills (workspace + project-level via workingDirectory)
  React.useEffect(() => {
    if (!activeWorkspaceId) {
      setSkillsAtom([])
      return
    }
    window.electronAPI
      .getSkills(activeWorkspaceId, activeSessionWorkingDirectory)
      .then((loaded) => setSkillsAtom(loaded || []))
      .catch((err) => {
        console.error('[WorkspaceDataProvider] Failed to load skills:', err)
      })
  }, [activeWorkspaceId, activeSessionWorkingDirectory, setSkillsAtom])

  // Live skill updates
  React.useEffect(() => {
    const cleanup = window.electronAPI.onSkillsChanged((workspaceId, updatedSkills) => {
      if (workspaceId !== activeWorkspaceId) return
      setSkillsAtom(updatedSkills || [])
    })
    return cleanup
  }, [activeWorkspaceId, setSkillsAtom])

  const enrichedContext = React.useMemo<AppShellContextType>(
    () => ({
      ...contextValue,
      enabledSources: sources,
      skills,
      activeSessionWorkingDirectory,
      onTestAutomation: handleTestAutomation,
      onToggleAutomation: handleToggleAutomation,
      onDuplicateAutomation: handleDuplicateAutomation,
      onDeleteAutomation: handleDeleteAutomation,
      automationTestResults,
      getAutomationHistory,
      onReplayAutomation: handleReplayAutomation,
    }),
    [
      contextValue,
      sources,
      skills,
      activeSessionWorkingDirectory,
      handleTestAutomation,
      handleToggleAutomation,
      handleDuplicateAutomation,
      handleDeleteAutomation,
      automationTestResults,
      getAutomationHistory,
      handleReplayAutomation,
    ],
  )

  return (
    <AppShellProvider value={enrichedContext}>
      {children}
      <Dialog
        open={!!automationPendingDelete}
        onOpenChange={(open) => {
          if (!open) setAutomationPendingDelete(null)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('dialog.deleteAutomation.title')}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="dialog.deleteAutomation.description"
                values={{ name: pendingDeleteAutomation?.name }}
                components={{ strong: <strong /> }}
              />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutomationPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAutomation}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShellProvider>
  )
}
