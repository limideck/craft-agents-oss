import { ChatPanel } from '../modules/agents/panels/chat-panel'
import { registerPanel } from '../registry/panel-registry'

let registered = false

/**
 * Panels any module layout may host (not owned by a single ActivityBar module).
 * Call once from ensureWorkbenchModulesRegistered.
 */
export function registerSharedWorkbenchPanels(): void {
  if (registered) return
  registered = true
  registerPanel({
    component: 'chat',
    title: 'Chat',
    render: (params) => <ChatPanel params={params} />,
  })
}
