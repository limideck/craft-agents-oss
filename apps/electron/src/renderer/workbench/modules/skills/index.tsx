import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BookOpen, Plus } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { SkillsListPanel } from '@/components/lists/SkillsListPanel'
import SkillInfoPage from '@/pages/SkillInfoPage'
import { useAppShellContext, useActiveWorkspace } from '@/context/AppShellContext'
import { skillsAtom } from '@/atoms/skills'
import { Button } from '@/components/ui/button'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../dock/panel-primitives'
import { ActivityShell } from '../../shell/ActivityShell'
import { selectedSkillSlugAtom } from '../stock-store'
import type { LoadedSkill } from '../../../../shared/types'

function SkillsActivityView() {
  const { t } = useTranslation()
  const skills = useAtomValue(skillsAtom)
  const selectedSlug = useAtomValue(selectedSkillSlugAtom)
  const setSelectedSlug = useSetAtom(selectedSkillSlugAtom)
  const { activeWorkspaceId, activeSessionWorkingDirectory } = useAppShellContext()
  const activeWorkspace = useActiveWorkspace()

  // silence unused — workingDirectory flows via SkillInfoPage
  void activeSessionWorkingDirectory

  const handleDelete = React.useCallback(
    async (skillSlug: string) => {
      if (!activeWorkspaceId) return
      try {
        await window.electronAPI.deleteSkill(activeWorkspaceId, skillSlug)
        if (selectedSlug === skillSlug) setSelectedSlug(null)
        toast.success(t('toast.deletedSkill', { slug: skillSlug }))
      } catch (err) {
        console.error('[Skills] Failed to delete skill:', err)
        toast.error(t('toast.failedToDeleteSkill'))
      }
    },
    [activeWorkspaceId, selectedSlug, setSelectedSlug, t],
  )

  const handleClick = React.useCallback(
    (skill: LoadedSkill) => {
      setSelectedSlug(skill.slug)
    },
    [setSelectedSlug],
  )

  if (!activeWorkspaceId) {
    return (
      <ActivityShell title={t('sidebar.skills')}>
        <div className="p-3 text-xs text-muted-foreground">No workspace selected.</div>
      </ActivityShell>
    )
  }

  return (
    <ActivityShell
      title={t('sidebar.skills')}
      scroll={false}
      bodyClassName="overflow-hidden"
      actions={
        activeWorkspace?.rootPath ? (
          <EditPopover
            align="end"
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={t('skillsList.addSkill')}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
            {...getEditConfig('add-skill', activeWorkspace.rootPath)}
          />
        ) : undefined
      }
    >
      <SkillsListPanel
        skills={skills}
        workspaceId={activeWorkspaceId}
        workspaceRootPath={activeWorkspace?.rootPath}
        onSkillClick={handleClick}
        onDeleteSkill={handleDelete}
        selectedSkillSlug={selectedSlug}
        className="h-full"
      />
    </ActivityShell>
  )
}

function SkillDetailPanel() {
  const selectedSlug = useAtomValue(selectedSkillSlugAtom)
  const { activeWorkspaceId, activeSessionWorkingDirectory } = useAppShellContext()

  if (!selectedSlug || !activeWorkspaceId) {
    return (
      <PanelRoot>
        <PanelHeaderBar>
          <span className="font-medium truncate">Skill</span>
        </PanelHeaderBar>
        <PanelBody className="flex items-center justify-center text-muted-foreground text-sm">
          Select a skill from the list.
        </PanelBody>
      </PanelRoot>
    )
  }

  return (
    <PanelRoot>
      <PanelBody padding={false} scroll className="flex flex-col">
        <SkillInfoPage
          skillSlug={selectedSlug}
          workspaceId={activeWorkspaceId}
          workingDirectory={activeSessionWorkingDirectory}
        />
      </PanelBody>
    </PanelRoot>
  )
}

export const skillsModule: WorkbenchModule = {
  id: 'skills',
  title: 'Skills',
  icon: <BookOpen className="h-4 w-4" />,
  order: 90,
  placement: 'footer',
  defaultLayout: {
    columns: [
      {
        id: 'center',
        width: 1,
        groups: [{ id: 'group-skill-detail', panels: [{ id: 'skill-detail', component: 'skill-detail', title: 'Skill' }] }],
      },
    ],
  },
  panels: [
    {
      component: 'skill-detail',
      title: 'Skill',
      singleton: true,
      render: () => <SkillDetailPanel />,
    },
  ],
  activityView: SkillsActivityView,
}
