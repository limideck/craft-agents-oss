import { useState } from "react";
import { GitBranch, MoreHorizontal, Filter, Mic, Plus } from "lucide-react";
import { sidebarItems, tasks } from "./data";
import { cn } from "@/lib/utils";

export function LeftSidebar() {
  const [activeItem, setActiveItem] = useState("new-agent");
  const [activeTask, setActiveTask] = useState("task-1");

  return (
    <div className="flex h-full flex-col bg-ide-sidebar text-ide-text">
      {/* Nav items */}
      <div className="px-2 pt-2 pb-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                activeItem === item.id
                  ? "bg-ide-hover text-ide-text"
                  : "text-ide-text-muted hover:bg-ide-hover hover:text-ide-text",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="px-2.5 py-1 text-[11px] font-medium text-ide-text-dim">Today</div>
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => setActiveTask(task.id)}
            className={cn(
              "group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
              activeTask === task.id
                ? "bg-ide-hover text-ide-text"
                : "text-ide-text-muted hover:bg-ide-hover hover:text-ide-text",
            )}
          >
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-ide-text-dim" />
            <span className="flex-1 truncate">{task.title}</span>
            {task.additions > 0 && (
              <span className="shrink-0 text-[11px] text-ide-add">+{task.additions}</span>
            )}
            {task.deletions > 0 && (
              <span className="shrink-0 text-[11px] text-ide-del">-{task.deletions}</span>
            )}
          </button>
        ))}
      </div>

      {/* User */}
      <div className="flex items-center gap-2 border-t border-ide-border px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ide-accent text-[12px] font-medium text-white">
          v
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-[13px] text-ide-text">v willet</div>
          <div className="text-[10px] text-ide-text-dim">Pro+</div>
        </div>
        <button className="rounded p-1 text-ide-text-dim hover:bg-ide-hover hover:text-ide-text">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <button className="rounded p-1 text-ide-text-dim hover:bg-ide-hover hover:text-ide-text">
          <Filter className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function LeftSidebarHeader() {
  return (
    <div className="flex h-9 items-center justify-between border-b border-ide-border bg-ide-sidebar px-3">
      <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-orange-400 to-pink-500">
        <div className="h-3 w-3 rotate-45 bg-white/90" />
      </div>
      <div className="flex items-center gap-1 text-ide-text-dim">
        <button className="rounded p-1 hover:bg-ide-hover hover:text-ide-text">
          <PanelIcon />
        </button>
        <button className="rounded p-1 hover:bg-ide-hover hover:text-ide-text">
          <SearchIcon />
        </button>
      </div>
    </div>
  );
}

function PanelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export { Plus, Mic };
