import { useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  BookOpen,
  ExternalLink,
  History,
  Library,
  Mail,
  Pencil,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useOpenAgentChat, useCloseAgentChat } from '../../../chat'
import {
  patchArticleMeta,
  rssAddFeedOpenAtom,
  rssArticlesAtom,
  rssCommandOpenAtom,
  rssLocalStateAtom,
  rssSelectedArticleIdAtom,
  rssSidebarSelectionAtom,
  type ReaderStatus,
} from '../store'
import { refreshRssData, useRssWorkspaceData } from '../use-rss-data'

/** ⌘K 命令菜单 — 阅读模块。 */
export function RssCommandPalette() {
  const [open, setOpen] = useAtom(rssCommandOpenAtom)
  const selectedId = useAtomValue(rssSelectedArticleIdAtom)
  const articles = useAtomValue(rssArticlesAtom)
  const setLocalState = useSetAtom(rssLocalStateAtom)
  const setAddOpen = useSetAtom(rssAddFeedOpenAtom)
  const setSelection = useSetAtom(rssSidebarSelectionAtom)
  const openAgentChat = useOpenAgentChat()
  const closeAgentChat = useCloseAgentChat()
  const { workspaceId } = useRssWorkspaceData()

  const article = selectedId ? articles.find((a) => a.id === selectedId) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  const setStatus = (status: ReaderStatus) => {
    if (!article) return
    setLocalState((prev) =>
      patchArticleMeta(prev, article.id, {
        status,
        ...(status === 'read' ? { lastViewedAt: Date.now() } : {}),
      }),
    )
  }

  const toggleStar = async () => {
    if (!article || !workspaceId) return
    try {
      await window.electronAPI.rssToggleStar(workspaceId, article, !article.isStarred)
      await refreshRssData()
    } catch {
      // ignore
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="输入命令…" />
      <CommandList>
        <CommandEmpty>未找到命令</CommandEmpty>
        <CommandGroup heading="资料库">
          <CommandItem onSelect={() => run(() => setAddOpen(true))}>
            <Plus className="mr-2 h-4 w-4" />
            添加内容…
          </CommandItem>
          <CommandItem onSelect={() => run(() => setSelection({ kind: 'view', view: 'all' }))}>
            <Library className="mr-2 h-4 w-4" />
            前往全部
          </CommandItem>
          <CommandItem onSelect={() => run(() => setSelection({ kind: 'library', id: 'unread' }))}>
            <Mail className="mr-2 h-4 w-4" />
            前往未读
          </CommandItem>
          <CommandItem onSelect={() => run(() => setSelection({ kind: 'view', view: 'starred' }))}>
            <Star className="mr-2 h-4 w-4" />
            前往收藏
          </CommandItem>
          <CommandItem onSelect={() => run(() => setSelection({ kind: 'library', id: 'history' }))}>
            <History className="mr-2 h-4 w-4" />
            前往历史
          </CommandItem>
          <CommandItem onSelect={() => run(() => closeAgentChat())}>
            <Sparkles className="mr-2 h-4 w-4" />
            关闭 AI Chat
          </CommandItem>
        </CommandGroup>
        {article ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="当前文章">
              <CommandItem
                onSelect={() =>
                  run(() =>
                    void openAgentChat({
                      placement: 'right',
                      title: 'AI Chat',
                      context: {
                        type: 'rss-article',
                        articleId: article.id,
                        title: article.title,
                        feedTitle: article.feedName,
                        url: article.link,
                      },
                    }),
                  )
                }
              >
                <Sparkles className="mr-2 h-4 w-4" />
                打开 AI Chat
              </CommandItem>
              <CommandItem onSelect={() => run(() => void toggleStar())}>
                <Star className="mr-2 h-4 w-4" />
                切换收藏
              </CommandItem>
              <CommandItem onSelect={() => run(() => setStatus('unread'))}>
                <Mail className="mr-2 h-4 w-4" />
                标为未读
              </CommandItem>
              <CommandItem onSelect={() => run(() => setStatus('read'))}>
                <BookOpen className="mr-2 h-4 w-4" />
                标为已读
              </CommandItem>
              {article.link ? (
                <CommandItem
                  onSelect={() => run(() => void window.electronAPI.openUrl(article.link!))}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  打开原文
                </CommandItem>
              ) : null}
              <CommandItem
                onSelect={() =>
                  run(() =>
                    void openAgentChat({
                      placement: 'right',
                      title: 'AI Chat',
                      seedPrompt: `请用中文总结这篇文章「${article.title}」的要点。`,
                      context: {
                        type: 'rss-article',
                        articleId: article.id,
                        title: article.title,
                        feedTitle: article.feedName,
                        url: article.link,
                      },
                    }),
                  )
                }
              >
                <Pencil className="mr-2 h-4 w-4" />
                AI 总结
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
