import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import type { IDockviewHeaderActionsProps } from 'dockview-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
} from '@/components/ui/styled-dropdown'
import { Button } from '@/components/ui/button'
import { activeModuleIdAtom } from '../store/workbench-store'
import {
  AGENTS_TOOL_PANELS,
  openAgentsToolPanel,
  type AgentsToolPanelId,
} from '../modules/agents/open-agents-tools'

const TOOL_TITLE_KEYS: Record<AgentsToolPanelId, string> = {
  files: 'workbench.agents.panels.files',
  changes: 'workbench.agents.panels.changes',
  terminal: 'workbench.agents.panels.terminal',
}

/**
 * Dockview right-header "+" control for Agents tool groups.
 * Adds Files / Changes / Terminal tabs via focusOrAddPanel — no parallel tab system.
 */
export function AgentsAddTabHeaderActions({
  containerApi,
  group,
  panels,
}: IDockviewHeaderActionsProps) {
  const { t } = useTranslation()
  const activeModuleId = useAtomValue(activeModuleIdAtom)

  const isAgentsToolsGroup = useMemo(() => {
    if (activeModuleId !== 'agents') return false
    // Show on groups that already host tool panels, or empty groups created as right splits.
    return panels.some((p) => AGENTS_TOOL_PANELS.some((tool) => tool.id === p.id))
  }, [activeModuleId, panels])

  const available = useMemo(() => {
    if (!isAgentsToolsGroup) return []
    return AGENTS_TOOL_PANELS.filter((tool) => !containerApi.getPanel(tool.id))
  }, [isAgentsToolsGroup, containerApi, panels])

  if (!isAgentsToolsGroup || available.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          title={t('workbench.agents.addTab')}
          aria-label={t('workbench.agents.addTab')}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <StyledDropdownMenuContent align="end" className="min-w-[140px]">
        {available.map((tool) => (
          <StyledDropdownMenuItem
            key={tool.id}
            onSelect={() =>
              openAgentsToolPanel({
                id: tool.id,
                // Tab into the group that owns this "+" control.
                referenceGroupId: group.id,
              })
            }
          >
            {t(TOOL_TITLE_KEYS[tool.id], tool.title)}
          </StyledDropdownMenuItem>
        ))}
      </StyledDropdownMenuContent>
    </DropdownMenu>
  )
}
