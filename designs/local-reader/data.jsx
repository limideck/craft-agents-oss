/* Mock local library — persisted lightly via localStorage in app.jsx */

const TAG_COLORS = {
  AI: '#7c6bc4',
  Design: '#5b8def',
  macOS: '#6b7280',
  Research: '#3d9a6a',
  Writing: '#c47a3a',
  Product: '#c45b8a',
  'local-first': '#4a90a4',
  software: '#6b7280',
  notes: '#8b7ec8',
  philosophy: '#9a7b4a',
};

const FOLDERS = [
  {
    id: 'workbench',
    name: 'Workbench',
    children: [
      { id: 'product-research', name: 'Product Research' },
      { id: 'ai-agent', name: 'AI Agent' },
      { id: 'interaction', name: 'Interaction Design' },
    ],
  },
  { id: 'personal-kb', name: 'Personal Knowledge' },
];

const SUBSCRIPTIONS = [
  { id: 's1', name: 'Design Notes', type: 'rss', count: 12 },
  { id: 's2', name: 'Martin Kleppmann', type: 'rss', count: 3 },
  { id: 's3', name: '@localfirst', type: 'x', count: 8 },
  { id: 's4', name: 'YouTube · Agent Lab', type: 'youtube', count: 5 },
  { id: 's5', name: '微博 · 产品观察', type: 'weibo', count: 4 },
];

const ITEMS = [
  {
    id: '1',
    title: '三栏阅读器如何在 Workbench 里既密又可读',
    excerpt:
      '把订阅、入库与阅读拆成导航 / 列表 / 正文，并让 AI Sidebar 成为第四态，而不是第四栏常驻。',
    body: `<p>本地优先的阅读模块，核心不是「又一个 RSS 客户端」，而是把多源内容收成同一套可标注、可收藏、可再创作的资料。</p>
<p>三栏结构沿用 feedoverflow / Mail 的肌肉记忆：左侧管来源与整理，中间扫条目，右侧沉浸阅读。AI 以 Sidebar 与划词条出现，不抢阅读面。</p>
<h2>设计原则</h2>
<ul>
<li>密度跟随 Grose workbench：直角、细边、30–40px chrome</li>
<li>收藏 / 标签 / 目录正交：同一条内容可同时存在于多维</li>
<li>采集入口统一：URL、附件、Markdown、订阅都进同一库</li>
</ul>
<p>选中正文后，可直接翻译、润色、解释，或送进 AI Chat 继续追问。</p>`,
    summary:
      '用三栏 + 可折叠 AI Sidebar 承接本地多源阅读；整理靠标签与树形目录，AI 做划词与摘要辅助，不打断主阅读流。',
    type: 'web',
    source: 'Design Notes',
    sourceKind: 'rss',
    author: 'Workbench Design',
    time: '9m',
    readMins: 6,
    favorite: true,
    tags: ['Design', 'Product', 'Research'],
    folderId: 'product-research',
    status: 'inbox',
    progress: 0.42,
    cover:
      'linear-gradient(135deg, oklch(0.72 0.08 293), oklch(0.88 0.04 265), oklch(0.78 0.06 200))',
  },
  {
    id: '2',
    title: 'The Quiet Revolution of Local-First Software',
    excerpt:
      'Local-first software is a set of principles for software that enables both collaboration and ownership…',
    body: `<p>Cloud apps have become the default. But they come with a cost: you lose ownership of your data, and the software stops working when the network does.</p>
<p>Local-first software keeps primary copies of data on the user's device. Sync is a feature, not a prerequisite for using the app.</p>
<blockquote>Your data, your device, your tools — still able to collaborate.</blockquote>
<p>For a reading library, that means articles, PDFs, notes, and highlights live in the workspace SQLite — agents and sync layers are optional peers.</p>`,
    summary:
      'Local-first keeps data on-device as the source of truth; collaboration via sync rather than a central server. Fits a workspace-local reader library.',
    type: 'web',
    source: 'martin.kleppmann.com',
    sourceKind: 'url',
    author: 'Martin Kleppmann',
    time: '2h',
    readMins: 8,
    favorite: true,
    tags: ['local-first', 'software', 'philosophy'],
    folderId: 'personal-kb',
    status: 'reading',
    progress: 0.42,
    cover: null,
  },
  {
    id: '3',
    title: 'Agent 工作台里的「选中即处理」交互笔记',
    excerpt: '划词工具条应贴合选区、键盘可达，并与 ⌘K / Chat Sidebar 共用同一套 Agent 能力。',
    body: `<p>划词条不是第二套命令系统。翻译、润色、解释、问 AI、续写都应映射到同一 Agent 工具面。</p>
<p>在 Reader 里：选中 → 浮条；⌘K → 全局命令；右侧 Sidebar → 多轮对话。三者入口不同，能力同源。</p>`,
    summary: '划词、⌘K、Chat Sidebar 共用 Agent 能力面，避免三套互不联通的 AI 入口。',
    type: 'note',
    source: 'Markdown',
    sourceKind: 'markdown',
    author: 'You',
    time: '昨天',
    readMins: 3,
    favorite: false,
    tags: ['AI', 'Design', 'notes'],
    folderId: 'interaction',
    status: 'inbox',
    progress: 0,
    cover: null,
  },
  {
    id: '4',
    title: 'Building Reliable Multi-Agent Workflows (PDF)',
    excerpt: '38 pages · architecture patterns for durable agent runs, retries, and human-in-the-loop gates.',
    body: `<p class="pdf-stub">PDF attachment preview</p>
<p>Chapter 1 introduces durable execution. Chapter 2 covers tool permissioning. Chapter 3 walks through a reading→summarize→draft pipeline that mirrors this Reader’s AI Sidebar flows.</p>`,
    summary: 'PDF on multi-agent reliability: durable runs, retries, HITL gates — useful for AI Sidebar agent design.',
    type: 'attachment',
    source: 'PDF',
    sourceKind: 'pdf',
    author: 'Internal docs',
    time: '3d',
    readMins: 38,
    pages: 38,
    favorite: false,
    tags: ['AI', 'software'],
    folderId: 'ai-agent',
    status: 'later',
    progress: 0.1,
    cover: null,
  },
  {
    id: '5',
    title: 'Demo: Local Reader AI Sidebar walkthrough',
    excerpt: 'YouTube · walk through summarize / translate / rewrite on a saved article.',
    body: `<p class="video-stub">▶ Video · 22:14</p>
<p>Walkthrough of opening AI Chat from the reader toolbar, then using selection actions to polish a paragraph and send it back into the note.</p>`,
    summary: 'Video demo of AI Sidebar + selection actions on local articles.',
    type: 'video',
    source: 'YouTube',
    sourceKind: 'youtube',
    author: 'Agent Lab',
    time: '5d',
    readMins: 22,
    duration: '22:14',
    favorite: false,
    tags: ['AI', 'Product'],
    folderId: 'ai-agent',
    status: 'archive',
    progress: 0,
    cover:
      'linear-gradient(160deg, oklch(0.35 0.06 293), oklch(0.55 0.12 293), oklch(0.4 0.04 250))',
  },
  {
    id: '6',
    title: '从微博收藏到本地库：社交订阅的入库策略',
    excerpt: '把 X / 微博 / YouTube 当作订阅源，规范化为同一 Item 模型后再打标签与归档。',
    body: `<p>社交账号订阅不是时间线浏览器。目标是「值得留下的条目」入库：标题、作者、原文链接、媒体附件、抓取时间。</p>
<p>入库后走与 RSS 相同的标签 / 目录 / 收藏 / AI 流程。</p>`,
    summary: 'Social feeds normalize into the same Item model as RSS/URL/PDF before tagging and AI.',
    type: 'web',
    source: '微博 · 产品观察',
    sourceKind: 'weibo',
    author: '产品观察',
    time: '1w',
    readMins: 4,
    favorite: false,
    tags: ['Product', 'Research'],
    folderId: 'product-research',
    status: 'reading',
    progress: 0.2,
    cover: null,
  },
];

const STORAGE_KEY = 'grose-local-reader-v1';

function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  } catch (_) {}
  return {
    items: ITEMS,
    folders: FOLDERS,
    tags: Object.keys(TAG_COLORS),
    subscriptions: SUBSCRIPTIONS,
  };
}

function saveLibrary(lib) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
  } catch (_) {}
}

function countBy(items, pred) {
  return items.filter(pred).length;
}

Object.assign(window, {
  TAG_COLORS,
  FOLDERS,
  SUBSCRIPTIONS,
  ITEMS,
  STORAGE_KEY,
  loadLibrary,
  saveLibrary,
  countBy,
});
