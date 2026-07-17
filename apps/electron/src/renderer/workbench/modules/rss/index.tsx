import { Rss } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { FeedsPanel } from './panels/feeds-panel'
import { ArticleListPanel } from './panels/article-list-panel'
import { ReaderPanel } from './panels/reader-panel'

/** RSS workbench module — mock UI only (no RPC / network). */
export const rssModule: WorkbenchModule = {
  id: 'rss',
  title: 'RSS',
  icon: <Rss className="h-4 w-4" />,
  order: 20,
  defaultLayout: 'rss-reading',
  panels: [
    {
      component: 'rss-feeds',
      title: 'Feeds',
      singleton: true,
      render: () => <FeedsPanel />,
    },
    {
      component: 'rss-article-list',
      title: 'Articles',
      singleton: true,
      render: () => <ArticleListPanel />,
    },
    {
      component: 'rss-reader',
      title: 'Reader',
      singleton: true,
      render: () => <ReaderPanel />,
    },
  ],
}
