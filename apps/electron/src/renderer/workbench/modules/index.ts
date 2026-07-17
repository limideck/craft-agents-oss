import { registerModule } from '../registry/module-registry'
import { agentsModule } from './agents'
import { rssModule } from './rss'
import { knowledgeModule } from './knowledge'
import { workflowsModule } from './workflows'

let registered = false

/** Register built-in workbench modules once (idempotent). */
export function ensureWorkbenchModulesRegistered(): void {
  if (registered) return
  registered = true
  registerModule(agentsModule)
  registerModule(rssModule)
  registerModule(knowledgeModule)
  registerModule(workflowsModule)
}

export { agentsModule, rssModule, knowledgeModule, workflowsModule }
