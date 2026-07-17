/**
 * OpenConnectorNavigator — section list for the OpenConnector console.
 * Mirrors SettingsNavigator styling.
 */

import { useTranslation } from 'react-i18next'
import {
  Activity,
  BookOpen,
  Cable,
  LayoutDashboard,
  TerminalSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import type { OpenConnectorSection } from './types'
import { StatusDot } from './shared-ui'

interface OpenConnectorNavigatorProps {
  selectedSection: OpenConnectorSection
  runtimeReady: boolean
  runtimeStarting: boolean
  onSelectSection: (section: OpenConnectorSection) => void
}

const SECTIONS: Array<{
  id: OpenConnectorSection
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'overview', labelKey: 'sidebar.openConnectorOverview', icon: LayoutDashboard },
  { id: 'providers', labelKey: 'sidebar.openConnectorProviders', icon: Cable },
  { id: 'actions', labelKey: 'sidebar.openConnectorActions', icon: TerminalSquare },
  { id: 'runs', labelKey: 'sidebar.openConnectorRuns', icon: Activity },
  { id: 'access', labelKey: 'sidebar.openConnectorAccess', icon: BookOpen },
]

export function OpenConnectorNavigator(props: OpenConnectorNavigatorProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {SECTIONS.map((item, index) => {
          const Icon = item.icon
          const isSelected = props.selectedSection === item.id
          return (
            <div key={item.id} data-selected={isSelected || undefined}>
              {index > 0 ? (
                <div className="pl-12 pr-4">
                  <Separator />
                </div>
              ) : null}
              <div className="relative group select-none pl-2 mr-2">
                <div className="absolute left-[20px] top-[14px] z-10">
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isSelected ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => props.onSelectSection(item.id)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-[8px] py-3 pl-10 pr-4 text-left text-sm outline-none',
                    'transition-[background-color] duration-75',
                    isSelected
                      ? 'bg-foreground/5 hover:bg-foreground/7'
                      : 'hover:bg-foreground/2',
                  )}
                >
                  <span className={cn('font-medium', isSelected ? 'text-foreground' : 'text-foreground/80')}>
                    {t(item.labelKey)}
                  </span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-border/40 px-4 py-3 text-xs text-muted-foreground">
        <StatusDot ok={props.runtimeReady} starting={props.runtimeStarting} />
        <span>
          {props.runtimeReady
            ? t('sidebar.openConnectorRuntimeReady')
            : props.runtimeStarting
              ? t('sidebar.openConnectorRuntimeStarting')
              : t('sidebar.openConnectorRuntimeOffline')}
        </span>
      </div>
    </div>
  )
}
