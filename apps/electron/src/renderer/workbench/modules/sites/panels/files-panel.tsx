import { useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react'
import type { CraftModulesSiteFileNode } from '@craft-agent/shared/craft-modules'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Spinner } from '@craft-agent/ui'
import { cn } from '@/lib/utils'
import {
  selectedSiteAtom,
  sitesFileContentAtom,
  sitesFileTreeAtom,
  sitesFilesLoadingAtom,
  sitesSelectedFilePathAtom,
} from '../store'
import { useSitesFilesData } from '../use-sites-data'

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: CraftModulesSiteFileNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const isDir = node.type === 'directory'
  const active = !isDir && selectedPath === node.path

  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1 py-0.5 pr-2 text-left text-xs',
          'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
          active && 'bg-foreground-10 text-foreground',
          !active && 'text-foreground/90',
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => {
          if (isDir) setOpen((v) => !v)
          else onSelect(node.path)
        }}
      >
        {isDir ? (
          open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {isDir ? (
          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && open && node.children?.length
        ? node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}

export function SitesFilesPanel() {
  const { t } = useTranslation()
  useSitesFilesData()
  const site = useAtomValue(selectedSiteAtom)
  const tree = useAtomValue(sitesFileTreeAtom)
  const loading = useAtomValue(sitesFilesLoadingAtom)
  const content = useAtomValue(sitesFileContentAtom)
  const [selectedPath, setSelectedPath] = useAtom(sitesSelectedFilePathAtom)

  return (
    <PanelRoot>
      <PanelHeaderBar>
        <span className="font-medium truncate">{t('workbench.sites.files')}</span>
      </PanelHeaderBar>
      <PanelBody padding={false} scroll={false} className="flex flex-col">
        {!site ? (
          <div className="p-3 text-sm text-muted-foreground">{t('workbench.sites.selectSite')}</div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-auto border-b border-border/80 py-1">
              {loading && tree.length === 0 ? (
                <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-3.5 w-3.5" /> {t('common.loading')}
                </div>
              ) : tree.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">{t('workbench.sites.noFiles')}</div>
              ) : (
                tree.map((node) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={selectedPath}
                    onSelect={setSelectedPath}
                  />
                ))
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {selectedPath ? (
                <pre className="m-0 p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words text-foreground/90">
                  <code>{content ?? ''}</code>
                </pre>
              ) : (
                <div className="p-3 text-xs text-muted-foreground">{t('workbench.sites.selectFile')}</div>
              )}
            </div>
          </>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
