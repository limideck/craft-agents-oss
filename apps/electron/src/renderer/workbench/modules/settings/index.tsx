import { useAtomValue, useSetAtom } from 'jotai'
import { Settings } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import SettingsNavigator from '@/pages/settings/SettingsNavigator'
import { getSettingsPageComponent } from '@/pages/settings/settings-pages'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../dock/panel-primitives'
import { settingsSubpageAtom } from '../stock-store'
import type { SettingsSubpage } from '../../../../shared/types'

function SettingsActivityView() {
  const subpage = useAtomValue(settingsSubpageAtom)
  const setSubpage = useSetAtom(settingsSubpageAtom)

  return (
    <SettingsNavigator
      selectedSubpage={subpage}
      onSelectSubpage={(next: SettingsSubpage) => setSubpage(next)}
    />
  )
}

function SettingsDetailPanel() {
  const subpage = useAtomValue(settingsSubpageAtom)
  const SettingsPage = getSettingsPageComponent(subpage)

  return (
    <PanelRoot>
      <PanelHeaderBar>
        <span className="font-medium truncate capitalize">{subpage}</span>
      </PanelHeaderBar>
      <PanelBody padding={false} scroll className="flex flex-col">
        <SettingsPage />
      </PanelBody>
    </PanelRoot>
  )
}

export const settingsModule: WorkbenchModule = {
  id: 'settings',
  title: 'Settings',
  icon: <Settings className="h-4 w-4" />,
  order: 100,
  placement: 'footer',
  defaultLayout: {
    columns: [
      {
        id: 'center',
        width: 1,
        groups: [
          {
            id: 'group-settings',
            panels: [{ id: 'settings-page', component: 'settings-page', title: 'Settings' }],
          },
        ],
      },
    ],
  },
  panels: [
    {
      component: 'settings-page',
      title: 'Settings',
      singleton: true,
      render: () => <SettingsDetailPanel />,
    },
  ],
  activityView: SettingsActivityView,
}
