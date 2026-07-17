import { useState } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { LeftSidebar, LeftSidebarHeader } from "./LeftSidebar";
import { CenterPanel, CenterPanelHeader } from "./CenterPanel";
import {
  TopTabsBar,
  FilesView,
  GitView,
  DesktopView,
  TerminalView,
} from "./RightPanel";
import type { TopTabId } from "./types";

/**
 * AgentIDE — Cursor-style agent IDE shell.
 *
 * Layout:
 *  ┌────────┬────────────┬─────────────────────────────┐
 *  │ Left   │ Center     │ Right (tabbed workspace)    │
 *  │ Sidebar│ Task/Chat  │ Git | Desktop | Terminal | Files │
 *  └────────┴────────────┴─────────────────────────────┘
 *
 * All 3 columns are horizontally resizable via react-resizable-panels.
 * Extend by adding new tabs to `topTabs` in ./data.ts and a matching view.
 */
export function AgentIDE() {
  const [activeTab, setActiveTab] = useState<TopTabId>("files");

  const renderTab = () => {
    switch (activeTab) {
      case "git":
        return <GitView />;
      case "desktop":
        return <DesktopView />;
      case "terminal":
        return <TerminalView />;
      case "files":
      default:
        return <FilesView />;
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-ide-bg text-ide-text">
      <PanelGroup orientation="horizontal" className="h-full w-full">
        {/* Left sidebar */}
        <Panel defaultSize="18%" minSize="12%" maxSize="30%">
          <div className="flex h-full flex-col">
            <LeftSidebarHeader />
            <div className="flex-1 overflow-hidden">
              <LeftSidebar />
            </div>
          </div>
        </Panel>

        <ResizeHandle />

        {/* Center */}
        <Panel defaultSize="38%" minSize="20%">
          <div className="flex h-full flex-col">
            <CenterPanelHeader />
            <div className="flex-1 overflow-hidden">
              <CenterPanel />
            </div>
          </div>
        </Panel>

        <ResizeHandle />

        {/* Right workspace */}
        <Panel defaultSize="44%" minSize="20%">

          <div className="flex h-full flex-col">
            <TopTabsBar active={activeTab} onChange={setActiveTab} />
            <div className="flex-1 overflow-hidden">{renderTab()}</div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative w-px bg-ide-border transition-colors data-[resize-handle-state=drag]:bg-ide-accent data-[resize-handle-state=hover]:bg-ide-accent">
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </PanelResizeHandle>
  );
}
