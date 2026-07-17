import type { RssArticle, RssFeed, RssFolder } from './types'

export const MOCK_FOLDERS: RssFolder[] = [
  {
    id: 'folder-tech',
    name: 'Tech',
    feedIds: ['feed-hn', 'feed-css'],
  },
  {
    id: 'folder-cn',
    name: '中文',
    feedIds: ['feed-sspai', 'feed-ruanyifeng'],
  },
]

export const MOCK_FEEDS: RssFeed[] = [
  {
    id: 'feed-hn',
    title: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    siteUrl: 'https://news.ycombinator.com',
    folderId: 'folder-tech',
    description: 'Front page stories',
  },
  {
    id: 'feed-css',
    title: 'CSS Tricks',
    url: 'https://css-tricks.com/feed/',
    siteUrl: 'https://css-tricks.com',
    folderId: 'folder-tech',
    description: 'Web design & development',
  },
  {
    id: 'feed-sspai',
    title: '少数派',
    url: 'https://sspai.com/feed',
    siteUrl: 'https://sspai.com',
    folderId: 'folder-cn',
    description: '高效工作，品质生活',
  },
  {
    id: 'feed-ruanyifeng',
    title: '阮一峰的网络日志',
    url: 'https://www.ruanyifeng.com/blog/atom.xml',
    siteUrl: 'https://www.ruanyifeng.com/blog/',
    folderId: 'folder-cn',
  },
  {
    id: 'feed-local',
    title: 'Local Notes',
    url: 'https://example.local/rss.xml',
    siteUrl: 'https://example.local',
    folderId: null,
    description: 'Unfiled mock feed',
  },
]

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString()

export const MOCK_ARTICLES: RssArticle[] = [
  {
    id: 'art-1',
    feedId: 'feed-hn',
    title: 'Show HN: A tiny layout engine for personal workbenches',
    author: 'alice',
    publishedAt: hoursAgo(2),
    summary: 'Dockable panels, persisted layouts, and module registries — without the IDE chrome.',
    contentHtml: `
      <p>Building a personal workbench is less about features and more about <strong>stable regions</strong>.</p>
      <p>This mock article walks through a three-column reading layout: feeds, list, and reader.</p>
      <ul>
        <li>Feeds stay scannable with unread counts</li>
        <li>The list is dense but calm</li>
        <li>The reader focuses on body text</li>
      </ul>
      <p><em>No network fetch — static HTML only.</em></p>
    `,
    url: 'https://news.ycombinator.com/item?id=1',
    unread: true,
  },
  {
    id: 'art-2',
    feedId: 'feed-hn',
    title: 'Ask HN: How do you organize your RSS folders?',
    author: 'bob',
    publishedAt: hoursAgo(8),
    summary: 'Folders vs tags, unread zero, and the eternal “I’ll read it later” pile.',
    contentHtml: `
      <p>Curious how others keep subscriptions tidy. Do you prefer folders, tags, or a flat list?</p>
      <blockquote>Unread zero is a lifestyle, not a feature.</blockquote>
      <p>Share your workflow in the comments.</p>
    `,
    url: 'https://news.ycombinator.com/item?id=2',
    unread: true,
  },
  {
    id: 'art-3',
    feedId: 'feed-css',
    title: 'Container queries for reader panes',
    author: 'Chris Coyier',
    publishedAt: daysAgo(1),
    summary: 'Make article typography adapt when the reader column shrinks.',
    contentHtml: `
      <p>When a docked reader pane gets narrow, body measure matters more than breakpoints on the viewport.</p>
      <pre><code>.reader-body { max-width: 42rem; }</code></pre>
      <p>Pair that with calm line-height and muted meta text.</p>
    `,
    url: 'https://css-tricks.com/container-queries-reader',
    unread: false,
  },
  {
    id: 'art-4',
    feedId: 'feed-sspai',
    title: '用 RSS 重建属于自己的信息流',
    author: '少数派编辑部',
    publishedAt: hoursAgo(5),
    summary: '从算法推荐回到主动订阅：文件夹、未读计数，以及安静的阅读区。',
    contentHtml: `
      <p>信息过载往往来自「被动推送」。RSS 的价值在于你决定<strong>订阅什么</strong>，以及<strong>何时阅读</strong>。</p>
      <h2>三个区域</h2>
      <ol>
        <li>订阅源侧栏：文件夹与未读</li>
        <li>文章列表：标题、来源、时间</li>
        <li>阅读区：标题、元信息与正文</li>
      </ol>
      <p>本页内容为静态 mock，不发起真实网络请求。</p>
    `,
    url: 'https://sspai.com/post/mock-rss',
    unread: true,
  },
  {
    id: 'art-5',
    feedId: 'feed-sspai',
    title: '键盘优先的阅读习惯',
    author: 'Eason',
    publishedAt: daysAgo(2),
    summary: 'j/k 浏览列表、o 打开原文——即使只是界面原型，也值得先预留交互位置。',
    contentHtml: `
      <p>好的阅读器不一定一开始就实现全部快捷键，但 UI 应暗示「可被高效操作」。</p>
      <p>例如：列表行有清晰的选中态，已读/未读一眼可辨。</p>
    `,
    url: 'https://sspai.com/post/mock-keyboard',
    unread: false,
  },
  {
    id: 'art-6',
    feedId: 'feed-ruanyifeng',
    title: '科技爱好者周刊（模拟）：个人工作台',
    author: '阮一峰',
    publishedAt: daysAgo(3),
    summary: '本周话题：把聊天、订阅与知识库放进同一个可拖拽布局。',
    contentHtml: `
      <p>个人工作台不是又一个仪表盘，而是<strong>可重组的信息面</strong>。</p>
      <p>RSS 阅读是其中一个模块：默认三栏，可拖走、可最大化。</p>
      <hr />
      <p>以上为 mock 正文，用于验证阅读区排版。</p>
    `,
    url: 'https://www.ruanyifeng.com/blog/mock-weekly',
    unread: true,
  },
  {
    id: 'art-7',
    feedId: 'feed-local',
    title: 'Welcome to the Craft RSS mock',
    author: 'Craft',
    publishedAt: hoursAgo(1),
    summary: 'UI-only reader: mark read in local state, no backend.',
    contentHtml: `
      <p>This feed is unfiled — useful for testing the sidebar “Other” section.</p>
      <p>Toggle <strong>Mark read</strong> in the reader toolbar; the change stays in Jotai only.</p>
    `,
    url: 'https://example.local/welcome',
    unread: true,
  },
  {
    id: 'art-8',
    feedId: 'feed-css',
    title: 'Shadows and surfaces in desktop UI',
    author: 'Una',
    publishedAt: daysAgo(4),
    summary: 'Match Craft’s six-color surfaces and minimal shadows — not IDE dark tokens.',
    contentHtml: `
      <p>Craft panels use <code>bg-card</code>, <code>border-border</code>, and soft elevation.</p>
      <p>Avoid importing alien <code>--ide-*</code> tokens into the workbench RSS module.</p>
    `,
    url: 'https://css-tricks.com/shadows-surfaces',
    unread: true,
  },
]

export function getFeedById(id: string): RssFeed | undefined {
  return MOCK_FEEDS.find((f) => f.id === id)
}

export function getArticleById(id: string): RssArticle | undefined {
  return MOCK_ARTICLES.find((a) => a.id === id)
}

export function countUnread(feedId?: string): number {
  return MOCK_ARTICLES.filter((a) => a.unread && (!feedId || a.feedId === feedId)).length
}
