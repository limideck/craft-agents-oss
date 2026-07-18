import { Rss } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { FeedsPanel } from './panels/feeds-panel'
import { ArticleListPanel } from './panels/article-list-panel'
import { ReaderPanel } from './panels/reader-panel'

/** Feed nav in ActivityBar side rail (like Agents Sessions). */
function RssActivityView() {
  return <FeedsPanel />
}

/** RSS workbench module — live data via grose-modules Go sidecar. */
export const rssModule: WorkbenchModule = {
  id: 'rss',
  title: 'RSS',
  icon: <Rss className="h-4 w-4" />,
  order: 50,
  // Feeds live in activityView; dock is Articles + Reader.
  defaultLayout: 'rss-reading',
  activityView: RssActivityView,
  panels: [
    {
      component: 'rss-feeds',
      title: 'Feeds',
      singleton: true,
      // Kept registered so persisted layouts / manual reopen still work.
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
