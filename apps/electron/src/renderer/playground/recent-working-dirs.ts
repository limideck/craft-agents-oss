export type RecentDirScenario = 'none' | 'few' | 'many'

const RECENT_DIR_SCENARIO_DATA: Record<RecentDirScenario, string[]> = {
  none: [],
  few: [
    '/Users/demo/projects/grose-agent',
    '/Users/demo/projects/grose-agent/apps/electron',
    '/Users/demo/projects/grose-agent/packages/shared',
  ],
  many: [
    '/Users/demo/projects/grose-agent',
    '/Users/demo/projects/grose-agent/apps/electron',
    '/Users/demo/projects/grose-agent/apps/viewer',
    '/Users/demo/projects/grose-agent/apps/cli',
    '/Users/demo/projects/grose-agent/packages/shared',
    '/Users/demo/projects/grose-agent/packages/server-core',
    '/Users/demo/projects/grose-agent/packages/pi-agent-server',
    '/Users/demo/projects/grose-agent/packages/ui',
    '/Users/demo/projects/grose-agent/scripts',
  ],
}

/** Return a copy of the fixture list for the selected scenario. */
export function getRecentDirsForScenario(scenario: RecentDirScenario): string[] {
  return [...RECENT_DIR_SCENARIO_DATA[scenario]]
}
