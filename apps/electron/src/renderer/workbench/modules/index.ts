import { registerModule } from '../registry/module-registry'
import { registerSharedWorkbenchPanels } from '../panels/register-shared'
import { agentsModule } from './agents'
import { sourcesModule } from './sources'
import { skillsModule } from './skills'
import { connectorsModule } from './connectors'
import { settingsModule } from './settings'
import { rssModule } from './rss'
import { knowledgeModule } from './knowledge'
import { workflowsModule } from './workflows'

let registered = false

/**
 * Register built-in workbench modules once (idempotent).
 * Order: shared panels → Agents → Sources → Skills → Connectors → RSS/KB/WF → Settings footer.
 */
export function ensureWorkbenchModulesRegistered(): void {
  if (registered) return
  registered = true
  registerSharedWorkbenchPanels()
  registerModule(agentsModule)
  registerModule(sourcesModule)
  registerModule(skillsModule)
  registerModule(connectorsModule)
  registerModule(rssModule)
  registerModule(knowledgeModule)
  registerModule(workflowsModule)
  registerModule(settingsModule)
}

export {
  agentsModule,
  sourcesModule,
  skillsModule,
  connectorsModule,
  settingsModule,
  rssModule,
  knowledgeModule,
  workflowsModule,
}
