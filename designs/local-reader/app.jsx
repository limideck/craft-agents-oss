const { useState, useEffect, useMemo, useCallback, useRef } = React;

function filterItems(items, selection, query, typeFilter) {
  let list = items.slice();
  if (selection.kind === 'view') {
    if (selection.id === 'inbox') list = list.filter((i) => i.status === 'inbox');
    else if (selection.id === 'favorite') list = list.filter((i) => i.favorite);
    else if (selection.id === 'recent') list = list.filter((i) => i.progress > 0);
    else if (selection.id === 'reading') list = list.filter((i) => i.status === 'reading');
    else if (selection.id === 'later') list = list.filter((i) => i.status === 'later');
    else if (selection.id === 'archive') list = list.filter((i) => i.status === 'archive');
  } else if (selection.kind === 'folder') {
    const id = selection.id;
    const parent = FOLDERS.find((f) => f.id === id);
    if (parent && parent.children) {
      const ids = new Set([id, ...parent.children.map((c) => c.id)]);
      list = list.filter((i) => ids.has(i.folderId));
    } else {
      list = list.filter((i) => i.folderId === id);
    }
  } else if (selection.kind === 'tag') {
    list = list.filter((i) => i.tags.includes(selection.id));
  }

  if (typeFilter !== 'all') {
    list = list.filter((i) => i.type === typeFilter);
  }

  if (query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.excerpt.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        i.source.toLowerCase().includes(q),
    );
  }
  return list;
}

function viewTitle(selection) {
  if (selection.kind === 'view') {
    const map = {
      inbox: 'Inbox',
      all: 'All',
      favorite: 'Favorites',
      recent: 'In progress',
      reading: 'Reading',
      later: 'Later',
      archive: 'Archive',
    };
    return map[selection.id] || 'Library';
  }
  if (selection.kind === 'tag') return `#${selection.id}`;
  if (selection.kind === 'folder') {
    for (const f of FOLDERS) {
      if (f.id === selection.id) return f.name;
      const c = (f.children || []).find((x) => x.id === selection.id);
      if (c) return c.name;
    }
  }
  return 'Library';
}

function AddDialog({ open, onClose, onSubmit }) {
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [mdTitle, setMdTitle] = useState('');
  const [mdBody, setMdBody] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [social, setSocial] = useState('x');

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabs = [
    ['url', 'URL'],
    ['file', 'Attachment'],
    ['markdown', 'Markdown'],
    ['rss', 'RSS'],
    ['social', 'Social'],
  ];

  const submit = () => {
    if (tab === 'url' && url.trim()) {
      let host = url.replace(/^https?:\/\//, '').split('/')[0] || 'web';
      try {
        host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      } catch (_) {}
      onSubmit({
        type: 'web',
        sourceKind: 'url',
        title: url.replace(/^https?:\/\//, '').slice(0, 60),
        excerpt: 'Fetched from URL (prototype).',
        body: `<p>Content fetched from <code>${url}</code>.</p>`,
        source: host,
        tags: ['Research'],
      });
    } else if (tab === 'file') {
      onSubmit({
        type: 'attachment',
        sourceKind: 'pdf',
        title: 'Uploaded attachment.pdf',
        excerpt: '12 pages · local file',
        body: '<p class="pdf-stub">PDF attachment</p>',
        source: 'PDF',
        pages: 12,
        readMins: 12,
        tags: ['Research'],
      });
    } else if (tab === 'markdown' && mdTitle.trim()) {
      onSubmit({
        type: 'note',
        sourceKind: 'markdown',
        title: mdTitle,
        excerpt: mdBody.slice(0, 120) || 'Markdown note',
        body: mdBody
          .split('\n')
          .map((l) => `<p>${l || '&nbsp;'}</p>`)
          .join(''),
        source: 'Markdown',
        tags: ['notes'],
      });
    } else if (tab === 'rss' && rssUrl.trim()) {
      onSubmit({
        type: 'web',
        sourceKind: 'rss',
        title: `Subscribed · ${rssUrl}`,
        excerpt: 'New RSS subscription added to local library.',
        body: `<p>Feed URL: ${rssUrl}</p>`,
        source: 'RSS',
        tags: ['software'],
        isSubscription: true,
      });
    } else if (tab === 'social') {
      const names = { x: 'X account', weibo: '微博账号', youtube: 'YouTube channel' };
      onSubmit({
        type: 'web',
        sourceKind: social,
        title: `Subscribe · ${names[social]}`,
        excerpt: 'Social subscription normalized into the local Item model.',
        body: `<p>Subscribed to ${names[social]}.</p>`,
        source: names[social],
        tags: ['Product'],
        isSubscription: true,
      });
    }
    setUrl('');
    setMdTitle('');
    setMdBody('');
    setRssUrl('');
    setTab('url');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Add content">
        <div className="modal-head">
          <div className="modal-tabs">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'is-active' : ''}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <I.X size={14} />
          </button>
        </div>
        <div className="modal-body">
          {tab === 'url' && (
            <>
              <label className="field-label">URL</label>
              <input
                className="field"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                autoFocus
              />
              <p className="hint">Fetch title, content, and cover into the local library.</p>
            </>
          )}
          {tab === 'file' && (
            <div className="dropzone">
              <I.Paperclip size={20} />
              <div>Drop PDF / image / video</div>
              <div className="hint">Prototype: clicking Add creates a sample PDF item.</div>
            </div>
          )}
          {tab === 'markdown' && (
            <>
              <label className="field-label">Title</label>
              <input
                className="field"
                value={mdTitle}
                onChange={(e) => setMdTitle(e.target.value)}
                placeholder="Note title"
                autoFocus
              />
              <label className="field-label">Content</label>
              <textarea
                className="field area"
                value={mdBody}
                onChange={(e) => setMdBody(e.target.value)}
                placeholder="Write in Markdown…"
                rows={8}
              />
            </>
          )}
          {tab === 'rss' && (
            <>
              <label className="field-label">Feed URL</label>
              <input
                className="field"
                value={rssUrl}
                onChange={(e) => setRssUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                autoFocus
              />
              <p className="hint">Also supports OPML import in the product build.</p>
            </>
          )}
          {tab === 'social' && (
            <>
              <label className="field-label">Platform</label>
              <div className="seg">
                {[
                  ['x', 'X'],
                  ['weibo', '微博'],
                  ['youtube', 'YouTube'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={social === id ? 'is-active' : ''}
                    onClick={() => setSocial(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="field-label">Account</label>
              <input className="field" placeholder="@handle or channel URL" />
            </>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-accent" onClick={submit}>
            Add to library
          </button>
        </div>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose, onAction }) {
  const [q, setQ] = useState('');
  const actions = [
    { id: 'add', label: 'Add content…', hint: 'URL / file / note / subscribe', icon: <I.Plus size={14} /> },
    { id: 'ai', label: 'Open AI Chat Sidebar', hint: 'Summarize · translate · rewrite', icon: <I.Sparkles size={14} /> },
    { id: 'favorite', label: 'Toggle favorite', hint: 'Current article', icon: <I.Star size={14} /> },
    { id: 'edit', label: 'Edit as Markdown', hint: 'Built-in editor', icon: <I.Edit size={14} /> },
    { id: 'translate', label: 'Translate article', hint: 'AI', icon: <I.Globe size={14} /> },
    { id: 'summary', label: 'Generate summary', hint: 'AI', icon: <I.Sparkles size={14} /> },
    { id: 'inbox', label: 'Go to Inbox', hint: 'Library', icon: <I.Inbox size={14} /> },
    { id: 'favorites', label: 'Go to Favorites', hint: 'Smart view', icon: <I.Star size={14} /> },
  ].filter((a) => !q || a.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-label="Command menu">
        <div className="cmdk-input">
          <I.Search size={14} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a command or search…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && actions[0]) {
                onAction(actions[0].id);
                onClose();
              }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul className="cmdk-list">
          {actions.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  onAction(a.id);
                  onClose();
                }}
              >
                <span className="cmdk-icon">{a.icon}</span>
                <span className="cmdk-label">{a.label}</span>
                <span className="cmdk-hint">{a.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EditModal({ open, item, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (open && item) {
      setTitle(item.title);
      setBody(item.body.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim());
    }
  }, [open, item]);

  if (!open || !item) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-label="Edit Markdown">
        <div className="modal-head">
          <strong>Edit Markdown</strong>
          <button type="button" className="icon-btn" onClick={onClose}>
            <I.X size={14} />
          </button>
        </div>
        <div className="modal-body">
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="field area tall"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
          />
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-accent"
            onClick={() => {
              onSave(item.id, {
                title,
                body: body
                  .split('\n')
                  .map((l) => `<p>${l || '&nbsp;'}</p>`)
                  .join(''),
                excerpt: body.slice(0, 120),
              });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const initial = useMemo(() => loadLibrary(), []);
  const [items, setItems] = useState(initial.items);
  const [selection, setSelection] = useState({ kind: 'view', id: 'inbox' });
  const [selectedId, setSelectedId] = useState(initial.items.find((i) => i.status === 'inbox')?.id || initial.items[0]?.id);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [aiOpen, setAiOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [expandedFolders, setExpandedFolders] = useState({ workbench: true });
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'I can summarize, translate, tag, or rewrite based on the open article. Try a quick action or ⌘K.',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [selectionToolbar, setSelectionToolbar] = useState(null);
  const readerRef = useRef(null);

  const folders = FOLDERS;
  const tags = Object.keys(TAG_COLORS);

  useEffect(() => {
    saveLibrary({ items, folders, tags, subscriptions: SUBSCRIPTIONS });
  }, [items, folders, tags]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visible = useMemo(
    () => filterItems(items, selection, query, typeFilter),
    [items, selection, query, typeFilter],
  );

  useEffect(() => {
    if (!visible.find((i) => i.id === selectedId)) {
      setSelectedId(visible[0]?.id || null);
    }
  }, [visible, selectedId]);

  const item = items.find((i) => i.id === selectedId) || null;

  const patchItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const toggleFavorite = (id) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)));
  };

  const pushAgent = (text) => {
    setMessages((m) => [...m, { role: 'assistant', text }]);
  };

  const sendAi = () => {
    const t = aiInput.trim();
    if (!t) return;
    setMessages((m) => [...m, { role: 'user', text: t }]);
    setAiInput('');
    setTimeout(() => {
      pushAgent(
        item
          ? `Regarding “${item.title}”: ${t}\n\n(Prototype reply — wire to workspace Agent in product.)`
          : `(Prototype) ${t}`,
      );
    }, 350);
  };

  const quickAi = (id) => {
    setAiOpen(true);
    const map = {
      summary: item?.summary || 'No summary yet.',
      translate: '【译】' + (item?.excerpt || ''),
      rewrite: `二次创作草稿：基于「${item?.title || '…'}」写一段产品笔记……`,
      tags: `建议标签：${(item?.tags || []).join(', ') || 'AI, Research'}`,
    };
    setMessages((m) => [
      ...m,
      { role: 'user', text: { summary: '总结这篇文章', translate: '翻译摘要', rewrite: '二次创作', tags: '建议标签' }[id] },
      { role: 'assistant', text: map[id] },
    ]);
  };

  const onSelectionAction = (action, text) => {
    setAiOpen(true);
    setSelectionToolbar(null);
    const labels = {
      translate: '翻译',
      polish: '润色',
      explain: '解释',
      ask: '问 AI',
      continue: '续写',
    };
    setMessages((m) => [
      ...m,
      { role: 'user', text: `${labels[action]}：\n“${text.slice(0, 180)}${text.length > 180 ? '…' : ''}”` },
      {
        role: 'assistant',
        text:
          action === 'translate'
            ? `译文：${text.slice(0, 120)}…（原型）`
            : action === 'polish'
              ? `润色后：${text.slice(0, 120)}…（原型）`
              : `已收到「${labels[action]}」请求。产品中会调用同一 Agent。`,
      },
    ]);
  };

  const onMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !readerRef.current) {
      setSelectionToolbar(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 2) {
      setSelectionToolbar(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const pane = readerRef.current.getBoundingClientRect();
    setSelectionToolbar({
      text,
      top: rect.top - pane.top - 44 + readerRef.current.scrollTop,
      left: Math.min(Math.max(rect.left - pane.left + rect.width / 2 - 160, 12), pane.width - 340),
    });
  };

  const handleAdd = (payload) => {
    const id = String(Date.now());
    const next = {
      id,
      favorite: false,
      status: 'inbox',
      progress: 0,
      time: 'now',
      readMins: payload.readMins || 3,
      author: 'You',
      folderId: 'product-research',
      cover: null,
      summary: payload.summary || null,
      tags: payload.tags || [],
      ...payload,
    };
    setItems((prev) => [next, ...prev]);
    setSelection({ kind: 'view', id: 'inbox' });
    setSelectedId(id);
  };

  const cmdAction = (id) => {
    if (id === 'add') setAddOpen(true);
    if (id === 'ai') setAiOpen(true);
    if (id === 'favorite' && item) toggleFavorite(item.id);
    if (id === 'edit') setEditOpen(true);
    if (id === 'translate') quickAi('translate');
    if (id === 'summary') quickAi('summary');
    if (id === 'inbox') setSelection({ kind: 'view', id: 'inbox' });
    if (id === 'favorites') setSelection({ kind: 'view', id: 'favorite' });
  };

  return (
    <div className="workbench" data-screen-label="workbench">
      <nav className="activity-bar" aria-label="Activity">
        <button type="button" className="act is-active" title="Reader">
          <I.Rss size={16} />
        </button>
        <button type="button" className="act" title="Agents">
          <I.Agents size={16} />
        </button>
        <button type="button" className="act" title="Settings">
          <I.Settings size={16} />
        </button>
        <div className="act-spacer" />
        <button
          type="button"
          className="act"
          title="Toggle theme"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        >
          {theme === 'light' ? '◐' : '◑'}
        </button>
      </nav>

      <div className={`reader-shell${aiOpen ? ' ai-open' : ''}`}>
        <NavPane
          items={items}
          folders={folders}
          tags={tags}
          selection={selection}
          onSelect={setSelection}
          query={query}
          onQuery={setQuery}
          onAdd={() => setAddOpen(true)}
          expandedFolders={expandedFolders}
          onToggleFolder={(id) =>
            setExpandedFolders((s) => ({ ...s, [id]: !(s[id] !== false) }))
          }
        />
        <ListPane
          title={viewTitle(selection)}
          items={visible}
          selectedId={selectedId}
          onSelect={setSelectedId}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          onAdd={() => setAddOpen(true)}
          onToggleFavorite={toggleFavorite}
        />
        <ReaderPane
          item={item}
          aiOpen={aiOpen}
          onToggleAi={() => setAiOpen((v) => !v)}
          onToggleFavorite={toggleFavorite}
          onEdit={() => setEditOpen(true)}
          onOpenCmd={() => setCmdOpen(true)}
          selectionToolbar={selectionToolbar}
          onSelectionAction={onSelectionAction}
          readerRef={readerRef}
          onMouseUp={onMouseUp}
        />
        <AiSidebar
          open={aiOpen}
          item={item}
          messages={messages}
          input={aiInput}
          onInput={setAiInput}
          onSend={sendAi}
          onClose={() => setAiOpen(false)}
          onQuick={quickAi}
        />
      </div>

      <AddDialog open={addOpen} onClose={() => setAddOpen(false)} onSubmit={handleAdd} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onAction={cmdAction} />
      <EditModal
        open={editOpen}
        item={item}
        onClose={() => setEditOpen(false)}
        onSave={(id, patch) => patchItem(id, patch)}
      />

      <div className="tweaks">
        <button type="button" className="tweaks-toggle" id="tweaks-btn">
          Tweaks
        </button>
      </div>
    </div>
  );
}

// Tiny tweaks: show/hide via click
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#tweaks-btn');
  if (!btn) return;
  const panel = document.getElementById('tweaks-panel');
  if (panel) panel.hidden = !panel.hidden;
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
