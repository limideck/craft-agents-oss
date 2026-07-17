import type { WorkbenchModule } from './types'
import { registerPanel } from './panel-registry'

const modules = new Map<string, WorkbenchModule>()

export function registerModule(mod: WorkbenchModule): void {
  if (modules.has(mod.id)) {
    console.warn(`[workbench] module "${mod.id}" already registered — overwriting`)
  }
  modules.set(mod.id, mod)
  for (const panel of mod.panels) {
    registerPanel(panel)
  }
}

export function getModule(id: string): WorkbenchModule | undefined {
  return modules.get(id)
}

export function getAllModules(): WorkbenchModule[] {
  return Array.from(modules.values()).sort((a, b) => a.order - b.order)
}

export function clearModuleRegistry(): void {
  modules.clear()
}
