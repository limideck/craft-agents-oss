import { useState } from "react";
import {
  FileText,
  MoreHorizontal,
  Maximize2,
  PanelRight,
  List,
} from "lucide-react";
import { topTabs, initialFileTree, readmeLines } from "./data";
import type { TopTabId, FileNode } from "./types";
import { cn } from "@/lib/utils";
import { FileTree } from "./FileTree";


export function TopTabsBar({
  active,
  onChange,
}: {
  active: TopTabId;
  onChange: (id: TopTabId) => void;
}) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-ide-border bg-ide-panel">
      <div className="flex items-center">
        {topTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative h-9 px-4 text-[13px] transition-colors",
              active === tab.id
                ? "text-ide-text"
                : "text-ide-text-dim hover:text-ide-text",
            )}
          >
            {tab.label}
            {active === tab.id && (
              <span className="absolute inset-x-3 bottom-0 h-[2px] bg-ide-accent" />
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 pr-2 text-ide-text-dim">
        <button className="rounded p-1 hover:bg-ide-hover hover:text-ide-text">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <button className="rounded p-1 hover:bg-ide-hover hover:text-ide-text">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 hover:bg-ide-hover hover:text-ide-text">
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function FilesView() {
  const [subTab, setSubTab] = useState<"files" | "artifacts">("files");
  const [tree, setTree] = useState<FileNode[]>(initialFileTree);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedName, setSelectedName] = useState("README.md");

  return (
    <div className="grid h-full grid-cols-[280px_1fr]">
      {/* Files list */}
      <div className="flex flex-col border-r border-ide-border bg-ide-panel">
        <div className="flex items-center gap-4 border-b border-ide-border px-3 py-2 text-[13px]">
          <button
            onClick={() => setSubTab("files")}
            className={cn(
              "transition-colors",
              subTab === "files" ? "text-ide-text" : "text-ide-text-dim hover:text-ide-text",
            )}
          >
            <span className="mr-1 inline-flex align-middle">
              <List className="inline h-3.5 w-3.5" />
            </span>
            Files
          </button>
          <button
            onClick={() => setSubTab("artifacts")}
            className={cn(
              "transition-colors",
              subTab === "artifacts"
                ? "text-ide-text"
                : "text-ide-text-dim hover:text-ide-text",
            )}
          >
            Artifacts
          </button>
        </div>
        {subTab === "files" ? (
          <FileTree
            nodes={tree}
            onChange={setTree}
            selectedId={selectedId}
            onSelect={(n) => {
              setSelectedId(n.id);
              if (n.type === "file") setSelectedName(n.name);
            }}
          />
        ) : (
          <div className="flex-1 p-4 text-[13px] text-ide-text-dim">
            No artifacts yet.
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex flex-col bg-ide-editor">
        <div className="flex h-9 items-center justify-between border-b border-ide-border bg-ide-panel px-3">
          <div className="flex items-center gap-2 text-[13px] text-ide-text">
            <List className="h-3.5 w-3.5 text-ide-text-dim" />
            {selectedName}
          </div>

          <button className="rounded bg-ide-input px-3 py-1 text-[12px] text-ide-text-muted hover:bg-ide-hover">
            Save
          </button>
        </div>
        <div className="flex-1 overflow-auto font-mono text-[13px] leading-6">
          <div className="flex min-h-full">
            <div className="sticky left-0 select-none border-r border-ide-border bg-ide-editor px-3 py-3 text-right text-ide-text-dim">
              {readmeLines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <pre className="flex-1 whitespace-pre-wrap px-4 py-3 text-ide-text">
              {readmeLines.map((line, i) => (
                <div key={i}>
                  <MarkdownLine line={line} />
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkdownLine({ line }: { line: string }) {
  if (line.startsWith("# ")) {
    return <span className="text-ide-md-h1">{line}</span>;
  }
  if (line.startsWith("## ")) {
    return <span className="text-ide-md-h2">{line}</span>;
  }
  // color URLs and links roughly
  const parts = line.split(/(\[[^\]]+\]\([^)]+\)|https?:\/\/\S+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\[[^\]]+\]\([^)]+\)$/.test(p)) {
          return (
            <span key={i} className="text-ide-md-link">
              {p}
            </span>
          );
        }
        if (/^https?:\/\//.test(p)) {
          return (
            <span key={i} className="text-ide-md-link underline">
              {p}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function GitView() {
  return (
    <Placeholder title="Git" body="Diff viewer and branch controls go here." />
  );
}
export function DesktopView() {
  return <Placeholder title="Desktop" body="Live desktop / browser preview." />;
}
export function TerminalView() {
  return (
    <div className="h-full bg-black p-3 font-mono text-[12px] text-green-400">
      <div>$ make build-ide</div>
      <div className="text-ide-text-dim">Building apps/ide/dist ...</div>
      <div>✓ built in 6.5s</div>
      <div className="mt-2">
        $ <span className="animate-pulse">▊</span>
      </div>
    </div>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-ide-editor">
      <div className="text-center">
        <div className="text-[15px] font-medium text-ide-text">{title}</div>
        <div className="mt-1 text-[13px] text-ide-text-dim">{body}</div>
      </div>
    </div>
  );
}
