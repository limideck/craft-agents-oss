import { Rss } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { FeedsPanel } from './panels/feeds-panel'
import { ArticleListPanel } from './panels/article-list-panel'
import { ReaderPanel } from './panels/reader-panel'
import { RssCommandPalette } from './components/rss-command-palette'

/** Reader nav in ActivityBar side rail (like Agents Sessions). */
function RssActivityView() {
  return (
    <>
      <FeedsPanel />
      <RssCommandPalette />
    </>
  )
}

/** Local Reader module — live RSS via grose-modules + local triage overlay. */
export const rssModule: WorkbenchModule = {
  id: 'rss',
  title: '阅读',
  icon: <Rss className="h-4 w-4" />,
  order: 50,
  // Nav lives in activityView; dock is Articles + Reader (+ AI Chat docked right).
  defaultLayout: 'rss-reading',
  activityView: RssActivityView,
  panels: [
    {
      component: 'rss-article-list',
      title: '文章',
      singleton: true,
      render: () => <ArticleListPanel />,
    },
    {
      component: 'rss-reader',
      title: '阅读',
      singleton: true,
      render: () => <ReaderPanel />,
    },
  ],
}
