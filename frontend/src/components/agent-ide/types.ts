import type { LucideIcon } from "lucide-react";

export type TopTabId = "git" | "desktop" | "terminal" | "files";

export interface TopTab {
  id: TopTabId;
  label: string;
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface AgentTask {
  id: string;
  title: string;
  additions: number;
  deletions: number;
  group: "Today" | "Yesterday" | "Earlier";
  active?: boolean;
}

export interface FileNode {
  id: string;
  name: string;
  type: "folder" | "file";
  icon?: "folder" | "md" | "yaml" | "generic";
  children?: FileNode[];
}

