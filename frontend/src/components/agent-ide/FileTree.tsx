import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from "lucide-react";
import type { FileNode } from "./types";
import { cn } from "@/lib/utils";

/**
 * Recursive file tree with native HTML5 drag & drop.
 * - Drag any file/folder onto a folder to move it inside.
 * - Drag onto empty area of root to move to root.
 * - Cannot drop a folder into itself or its descendants.
 */
export function FileTree({
  nodes,
  onChange,
  selectedId,
  onSelect,
}: {
  nodes: FileNode[];
  onChange: (next: FileNode[]) => void;
  selectedId?: string;
  onSelect?: (node: FileNode) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const move = useCallback(
    (sourceId: string, targetFolderId: string | null) => {
      if (sourceId === targetFolderId) return;
      let removed: FileNode | null = null;

      const remove = (list: FileNode[]): FileNode[] =>
        list
          .filter((n) => {
            if (n.id === sourceId) {
              removed = n;
              return false;
            }
            return true;
          })
          .map((n) =>
            n.type === "folder" && n.children
              ? { ...n, children: remove(n.children) }
              : n,
          );

      // guard: target must not be a descendant of source
      const isDescendant = (n: FileNode, id: string): boolean => {
        if (n.id === id) return true;
        return !!n.children?.some((c) => isDescendant(c, id));
      };
      const findNode = (list: FileNode[], id: string): FileNode | null => {
        for (const n of list) {
          if (n.id === id) return n;
          if (n.children) {
            const r = findNode(n.children, id);
            if (r) return r;
          }
        }
        return null;
      };
      const src = findNode(nodes, sourceId);
      if (src && targetFolderId && isDescendant(src, targetFolderId)) return;

      const withoutSource = remove(nodes);
      if (!removed) return;

      if (targetFolderId === null) {
        onChange([...withoutSource, removed]);
        return;
      }

      const insert = (list: FileNode[]): FileNode[] =>
        list.map((n) => {
          if (n.id === targetFolderId && n.type === "folder") {
            return { ...n, children: [...(n.children ?? []), removed as FileNode] };
          }
          if (n.type === "folder" && n.children) {
            return { ...n, children: insert(n.children) };
          }
          return n;
        });

      onChange(insert(withoutSource));
      setExpanded((prev) => new Set(prev).add(targetFolderId));
    },
    [nodes, onChange],
  );

  const renderNode = (node: FileNode, depth: number) => {
    const isFolder = node.type === "folder";
    const isOpen = expanded.has(node.id);
    const isDropTarget = dropTargetId === node.id && isFolder;
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id}>
        <div
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            setDragId(node.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", node.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setDropTargetId(null);
          }}
          onDragOver={(e) => {
            if (!isFolder) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            if (dropTargetId !== node.id) setDropTargetId(node.id);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (dropTargetId === node.id) setDropTargetId(null);
          }}
          onDrop={(e) => {
            if (!isFolder) return;
            e.preventDefault();
            e.stopPropagation();
            const id = e.dataTransfer.getData("text/plain") || dragId;
            if (id) move(id, node.id);
            setDropTargetId(null);
            setDragId(null);
          }}
          onClick={() => {
            if (isFolder) toggle(node.id);
            onSelect?.(node);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-1 px-2 py-[3px] text-[13px] transition-colors select-none",
            isSelected
              ? "bg-ide-hover text-ide-text"
              : "text-ide-text-muted hover:bg-ide-hover hover:text-ide-text",
            isDropTarget && "bg-ide-accent/20 outline outline-1 outline-ide-accent",
            dragId === node.id && "opacity-50",
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {isFolder ? (
            isOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-ide-text-dim" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-ide-text-dim" />
            )
          ) : (
            <span className="w-3 shrink-0" />
          )}
          {isFolder ? (
            isOpen ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-ide-folder" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-ide-folder" />
            )
          ) : (
            <FileText
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                node.icon === "md"
                  ? "text-ide-accent"
                  : node.icon === "yaml"
                    ? "text-yellow-500"
                    : "text-ide-text-dim",
              )}
            />
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {isFolder && isOpen && node.children && (
          <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto py-1",
        dropTargetId === "__root__" && "bg-ide-accent/10",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTargetId("__root__");
      }}
      onDragLeave={() => setDropTargetId(null)}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain") || dragId;
        if (id) move(id, null);
        setDropTargetId(null);
        setDragId(null);
      }}
    >
      {nodes.map((n) => renderNode(n, 0))}
    </div>
  );
}
