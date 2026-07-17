import { useAtomValue, useSetAtom } from 'jotai'
import { getAllModules } from '../registry/module-registry'
import { activeModuleIdAtom } from '../store/workbench-store'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@craft-agent/ui'

/**
 * Narrow left activity rail — module switcher.
 * Modules appear here solely via registerModule(); Shell has no module-specific branches.
 */
export function ActivityBar() {
  const modules = getAllModules()
  const activeId = useAtomValue(activeModuleIdAtom)
  const setActiveId = useSetAtom(activeModuleIdAtom)

  return (
    <nav
      className="flex flex-col items-center gap-1 w-12 shrink-0 border-r border-border bg-background py-2"
      aria-label="Workbench modules"
    >
      {modules.map((mod) => {
        const active = mod.id === activeId
        return (
          <Tooltip key={mod.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={mod.title}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground',
                  'hover:bg-foreground-5 hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  active && 'bg-foreground-10 text-foreground',
                )}
                onClick={() => setActiveId(mod.id)}
              >
                {mod.icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{mod.title}</TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  )
}
