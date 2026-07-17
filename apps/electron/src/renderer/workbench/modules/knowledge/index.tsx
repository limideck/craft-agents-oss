import { BookOpen } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { PlaceholderPanel } from '../agents/panels/placeholder-panel'

/** Placeholder Knowledge module — no business logic yet. */
export const knowledgeModule: WorkbenchModule = {
  id: 'knowledge',
  title: 'Knowledge',
  icon: <BookOpen className="h-4 w-4" />,
  order: 30,
  panels: [
    {
      component: 'kb-browse',
      title: 'Knowledge',
      singleton: true,
      render: () => (
        <PlaceholderPanel
          title="Knowledge Base"
          description="Knowledge module placeholder — Phase 3+."
        />
      ),
    },
    {
      component: 'kb-doc',
      title: 'Document',
      render: () => (
        <PlaceholderPanel title="Document" description="KB document placeholder." />
      ),
    },
    {
      component: 'kb-search',
      title: 'Search',
      render: () => (
        <PlaceholderPanel title="KB Search" description="KB search placeholder." />
      ),
    },
  ],
  activityView: function KnowledgeActivity() {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Knowledge bases will appear here.
      </div>
    )
  },
}
