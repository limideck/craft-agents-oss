import {
  LayoutDashboard,
  Sparkles,
  Bug,
  Zap,
} from "lucide-react";
import type { AgentTask, FileNode, SidebarItem, TopTab } from "./types";

export const sidebarItems: SidebarItem[] = [
  { id: "new-agent", label: "New Agent", icon: Sparkles },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "bugbot", label: "Bugbot", icon: Bug },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export const tasks: AgentTask[] = [
  {
    id: "task-1",
    title: "Ide agent 个人管理",
    additions: 4040,
    deletions: 76,
    group: "Today",
    active: true,
  },
  {
    id: "task-2",
    title: "Development environment setup",
    additions: 0,
    deletions: 0,
    group: "Today",
  },
];

export const topTabs: TopTab[] = [
  { id: "git", label: "Git" },
  { id: "desktop", label: "Desktop" },
  { id: "terminal", label: "Terminal" },
  { id: "files", label: "Files" },
];

const f = (name: string, icon: FileNode["icon"] = "generic"): FileNode => ({
  id: crypto.randomUUID(),
  name,
  type: "file",
  icon,
});
const d = (name: string, children: FileNode[] = []): FileNode => ({
  id: crypto.randomUUID(),
  name,
  type: "folder",
  children,
});

export const initialFileTree: FileNode[] = [
  d(".agents", [f("config.json"), f("README.md", "md")]),
  d(".github", [
    d("workflows", [f("ci.yml", "yaml"), f("release.yml", "yaml")]),
    f("CODEOWNERS"),
  ]),
  d(".vscode", [f("settings.json"), f("extensions.json")]),
  d("apps", [
    d("ide", [f("index.tsx"), f("router.tsx"), f("package.json")]),
    d("web", [f("index.tsx"), f("package.json")]),
  ]),
  d("docs", [
    f("features.md", "md"),
    f("ARCHITECTURE.md", "md"),
    f("roadmap.md", "md"),
  ]),
  d("scripts", [f("build.sh"), f("deploy.sh")]),
  f(".gitignore"),
  f(".pre-commit-config.yaml", "yaml"),
  f("AGENTS.md", "md"),
  f("CHANGELOG.md", "md"),
  f("CLAUDE.md", "md"),
  f("CONTRIBUTING.md", "md"),
  f("DESIGN.md", "md"),
  f("README.md", "md"),
  f("package.json"),
];

export const readmeLines: string[] = [
  "# Kandev",
  "",
  "Manage and run tasks in parallel. Orchestrate agents. Review",
  "changes. Ship value.",
  "",
  "## What",
  "",
  "Organize work across kanban and pipeline views with",
  "opinionated workflows and execute multiple tasks in parallel.",
  "Assign agents from any provider, and review their output in an",
  "integrated workspace — file editor, file tree, terminal,",
  "browser preview, and git changes in one place.",
  "",
  "## Vision",
  "",
  "Open source, multi-provider, no telemetry, not tied to any cloud.",
];
