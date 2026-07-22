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
  closeAgentChat,
  useOpenAgentChat,
  useCloseAgentChat,
  type AgentChatContext,
  type AgentChatPlacement,
  type OpenAgentChatOptions,
  type OpenAgentChatResult,
} from './chat'
export { focusOrAddWorkbenchPanel, activeModuleIdAtom, dockviewApiAtom } from './store/workbench-store'
export {
  openFileEditor,
  openFilesPanel,
  reopenFilePreview,
  useOpenFileEditor,
  useOpenFilesPanel,
  useReopenFilePreview,
  useLastPreviewPath,
  useFilesPanelSelectedPath,
  lastPreviewPathAtom,
  filesPanelSelectedPathAtom,
  PREVIEW_FILE_EDITOR_ID,
  FILES_PANEL_ID,
} from './modules/agents/open-file-editor'
export {
  openAgentsRightTools,
  openAgentsToolPanel,
  useAgentsRightToolsOpen,
  useOpenAgentsRightTools,
  useOpenAgentsToolPanel,
  AGENTS_TOOL_PANELS,
} from './modules/agents/open-agents-tools'
