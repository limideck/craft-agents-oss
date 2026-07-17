import { registerModule } from '../registry/module-registry'
import { registerSharedWorkbenchPanels } from '../panels/register-shared'
import { agentsModule } from './agents'
import { sourcesModule } from './sources'
import { skillsModule } from './skills'
import { automationsModule } from './automations'
import { connectorsModule } from './connectors'
import { settingsModule } from './settings'
import { rssModule } from './rss'
import { tablesModule } from './tables'
import { knowledgeModule } from './knowledge'
import { workflowsModule } from './workflows'

let registered = false

/**
 * Register built-in workbench modules once (idempotent).
 * Order: shared panels → Agents → Sources → Skills → Automations → Connectors → RSS/Tables/KB → Settings footer.
 * Workflows UI is folded into Automations (Flows); workflowsModule is not registered on the ActivityBar.
 */
export function ensureWorkbenchModulesRegistered(): void {
  if (registered) return
  registered = true
  registerSharedWorkbenchPanels()
  registerModule(agentsModule)
  registerModule(sourcesModule)
  registerModule(skillsModule)
  registerModule(automationsModule)
  registerModule(connectorsModule)
  registerModule(rssModule)
  registerModule(tablesModule)
  registerModule(knowledgeModule)
  registerModule(settingsModule)
}

export {
  agentsModule,
  sourcesModule,
  skillsModule,
  automationsModule,
  connectorsModule,
  settingsModule,
  rssModule,
  tablesModule,
  knowledgeModule,
  /** Kept for re-use / tests; not registered on ActivityBar (see automationsModule). */
  workflowsModule,
}
