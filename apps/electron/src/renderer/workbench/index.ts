export { WorkbenchShell } from './shell/WorkbenchShell'
export { ActivityBar } from './shell/ActivityBar'
export { isWorkbenchShellEnabled, setWorkbenchShellEnabled } from './feature'
export { ensureWorkbenchModulesRegistered } from './modules'
export type {
  WorkbenchModule,
  PanelContribution,
  CommandContribution,
  LayoutState,
  LayoutPresetId,
} from './registry/types'
export { registerModule, getModule, getAllModules } from './registry/module-registry'
export { registerPanel, getPanel, getAllPanels } from './registry/panel-registry'
export {
  openAgentChat,
  useOpenAgentChat,
  type AgentChatContext,
  type AgentChatPlacement,
  type OpenAgentChatOptions,
  type OpenAgentChatResult,
} from './chat'
export { focusOrAddWorkbenchPanel, activeModuleIdAtom, dockviewApiAtom } from './store/workbench-store'
