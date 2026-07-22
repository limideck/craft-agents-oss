function TypeIcon({ type }) {
  if (type === 'attachment') return <I.File size={12} />;
  if (type === 'video') return <I.Video size={12} />;
  if (type === 'note') return <I.Edit size={12} />;
  return <I.Globe size={12} />;
}

function typeLabel(item) {
  if (item.type === 'attachment') return item.pages ? `PDF · ${item.pages} pages` : 'PDF';
  if (item.type === 'video') return `Video · ${item.duration || item.source}`;
  if (item.type === 'note') return 'Note · Markdown';
  return `${item.sourceKind === 'rss' ? 'RSS' : 'Web'} · ${item.source}`;
}

function TagDot({ name }) {
  const color = TAG_COLORS[name] || 'var(--foreground-40)';
  return <span className="tag-dot" style={{ background: color }} title={name} />;
}

function TagChip({ name, onClick }) {
  return (
    <button type="button" className="tag-chip" onClick={onClick}>
      <TagDot name={name} />
      <span>{name}</span>
    </button>
  );
}

function NavRow({ active, icon, label, count, onClick, depth = 0 }) {
  return (
    <button
      type="button"
      className={`nav-row${active ? ' is-active' : ''}`}
      style={{ paddingLeft: 10 + depth * 12 }}
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
    >
      <span className="nav-row-icon">{icon}</span>
      <span className="nav-row-label">{label}</span>
      {count != null && count > 0 ? <span className="nav-row-count">{count}</span> : null}
    </button>
  );
}

function NavPane({
  items,
  folders,
  tags,
  selection,
  onSelect,
  query,
  onQuery,
  onAdd,
  expandedFolders,
  onToggleFolder,
}) {
  const counts = {
    inbox: countBy(items, (i) => i.status === 'inbox'),
    all: items.length,
    favorite: countBy(items, (i) => i.favorite),
    recent: countBy(items, (i) => i.progress > 0),
    reading: countBy(items, (i) => i.status === 'reading'),
    later: countBy(items, (i) => i.status === 'later'),
    archive: countBy(items, (i) => i.status === 'archive'),
  };

  const folderCount = (id) => countBy(items, (i) => i.folderId === id);
  const tagCount = (t) => countBy(items, (i) => i.tags.includes(t));

  const is = (kind, id) => selection.kind === kind && selection.id === id;

  return (
    <aside className="pane nav-pane" data-screen-label="nav">
      <header className="chrome-bar nav-chrome">
        <div className="nav-brand">
          <I.Rss size={14} />
          <span>Reader</span>
          <span className="local-pill">Local</span>
        </div>
        <button type="button" className="icon-btn" title="Add" onClick={onAdd}>
          <I.Plus size={14} />
        </button>
      </header>

      <div className="nav-search">
        <I.Search size={13} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search titles, tags…"
          aria-label="Search library"
        />
        <kbd>⌘K</kbd>
      </div>

      <div className="nav-scroll">
        <div className="nav-section-label">Library</div>
        <NavRow
          active={is('view', 'inbox')}
          icon={<I.Inbox size={13} />}
          label="Inbox"
          count={counts.inbox}
          onClick={() => onSelect({ kind: 'view', id: 'inbox' })}
        />
        <NavRow
          active={is('view', 'all')}
          icon={<I.Library size={13} />}
          label="All"
          count={counts.all}
          onClick={() => onSelect({ kind: 'view', id: 'all' })}
        />
        <NavRow
          active={is('view', 'reading')}
          icon={<I.BookOpen size={13} />}
          label="Reading"
          count={counts.reading}
          onClick={() => onSelect({ kind: 'view', id: 'reading' })}
        />
        <NavRow
          active={is('view', 'later')}
          icon={<I.Bookmark size={13} />}
          label="Later"
          count={counts.later}
          onClick={() => onSelect({ kind: 'view', id: 'later' })}
        />
        <NavRow
          active={is('view', 'archive')}
          icon={<I.Archive size={13} />}
          label="Archive"
          count={counts.archive}
          onClick={() => onSelect({ kind: 'view', id: 'archive' })}
        />

        <div className="nav-section-label">Smart</div>
        <NavRow
          active={is('view', 'favorite')}
          icon={<I.Star size={13} />}
          label="Favorites"
          count={counts.favorite}
          onClick={() => onSelect({ kind: 'view', id: 'favorite' })}
        />
        <NavRow
          active={is('view', 'recent')}
          icon={<I.Clock size={13} />}
          label="In progress"
          count={counts.recent}
          onClick={() => onSelect({ kind: 'view', id: 'recent' })}
        />

        <div className="nav-section-label">Folders</div>
        {folders.map((f) => {
          const open = expandedFolders[f.id] !== false;
          const hasChildren = f.children && f.children.length;
          return (
            <div key={f.id}>
              <div className="folder-row">
                {hasChildren ? (
                  <button
                    type="button"
                    className="folder-toggle"
                    onClick={() => onToggleFolder(f.id)}
                    aria-expanded={open}
                  >
                    {open ? <I.ChevronDown size={12} /> : <I.Chevron size={12} />}
                  </button>
                ) : (
                  <span className="folder-toggle spacer" />
                )}
                <NavRow
                  active={is('folder', f.id)}
                  icon={<I.Folder size={13} />}
                  label={f.name}
                  count={folderCount(f.id) + (f.children || []).reduce((n, c) => n + folderCount(c.id), 0)}
                  onClick={() => onSelect({ kind: 'folder', id: f.id })}
                />
              </div>
              {hasChildren && open
                ? f.children.map((c) => (
                    <NavRow
                      key={c.id}
                      depth={1}
                      active={is('folder', c.id)}
                      icon={<I.Folder size={12} />}
                      label={c.name}
                      count={folderCount(c.id)}
                      onClick={() => onSelect({ kind: 'folder', id: c.id })}
                    />
                  ))
                : null}
            </div>
          );
        })}

        <div className="nav-section-label">Tags</div>
        {tags.map((t) => (
          <NavRow
            key={t}
            active={is('tag', t)}
            icon={<TagDot name={t} />}
            label={t}
            count={tagCount(t)}
            onClick={() => onSelect({ kind: 'tag', id: t })}
          />
        ))}
      </div>

      <footer className="nav-footer">
        <I.Rss size={12} />
        <span>5 subscriptions · local SQLite</span>
      </footer>
    </aside>
  );
}

function ListPane({
  title,
  items,
  selectedId,
  onSelect,
  typeFilter,
  onTypeFilter,
  onAdd,
  onToggleFavorite,
}) {
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'web', label: 'Web' },
    { id: 'attachment', label: 'Files' },
    { id: 'note', label: 'Notes' },
    { id: 'video', label: 'Video' },
  ];

  return (
    <section className="pane list-pane" data-screen-label="list">
      <header className="chrome-bar list-chrome">
        <div className="list-title">
          <span className="font-medium">{title}</span>
          <span className="muted tabular">{items.length}</span>
        </div>
        <div className="list-actions">
          <button type="button" className="icon-btn" title="AI batch" onClick={onAdd}>
            <I.Sparkles size={13} />
          </button>
          <button type="button" className="btn-accent" onClick={onAdd}>
            <I.Plus size={12} />
            Add
          </button>
        </div>
      </header>

      <div className="type-tabs">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`type-tab${typeFilter === f.id ? ' is-active' : ''}`}
            onClick={() => onTypeFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="list-scroll">
        {items.length === 0 ? (
          <div className="empty">No items in this view.</div>
        ) : (
          <ul role="listbox" aria-label="Items">
            {items.map((item) => {
              const active = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`item-card${active ? ' is-active' : ''}`}
                    onClick={() => onSelect(item.id)}
                  >
                    <div className="item-meta">
                      <span className="item-type">
                        <TypeIcon type={item.type} />
                        {typeLabel(item)}
                      </span>
                      <span className="item-time">{item.time}</span>
                    </div>
                    <div className="item-main">
                      <div className="item-text">
                        <div className="item-title">{item.title}</div>
                        <div className="item-excerpt">{item.excerpt}</div>
                        <div className="item-tags">
                          {item.tags.slice(0, 3).map((t) => (
                            <span key={t} className="tag-mini">
                              #{t}
                            </span>
                          ))}
                          <span className="item-read">{item.readMins} min</span>
                        </div>
                      </div>
                      {item.cover ? (
                        <div className="item-thumb" style={{ background: item.cover }} />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={`fav-btn${item.favorite ? ' is-on' : ''}`}
                      title={item.favorite ? 'Unfavorite' : 'Favorite'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(item.id);
                      }}
                    >
                      <I.Star size={12} />
                    </button>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ReaderPane({
  item,
  aiOpen,
  onToggleAi,
  onToggleFavorite,
  onEdit,
  onOpenCmd,
  selectionToolbar,
  onSelectionAction,
  readerRef,
  onMouseUp,
}) {
  if (!item) {
    return (
      <section className="pane reader-pane" data-screen-label="reader">
        <header className="chrome-bar reader-chrome">
          <span className="font-medium">Reader</span>
        </header>
        <div className="empty tall">Select an item to read.</div>
      </section>
    );
  }

  const pct = Math.round((item.progress || 0) * 100);

  return (
    <section className="pane reader-pane" data-screen-label="reader">
      <header className="chrome-bar reader-chrome">
        <div className="reader-chrome-left">
          <button
            type="button"
            className={`icon-btn${item.favorite ? ' is-accent' : ''}`}
            title="Favorite"
            onClick={() => onToggleFavorite(item.id)}
          >
            <I.Star size={13} />
          </button>
          <button type="button" className="icon-btn" title="Edit Markdown" onClick={onEdit}>
            <I.Edit size={13} />
          </button>
          <button type="button" className="icon-btn" title="Tags" onClick={onOpenCmd}>
            <I.Tag size={13} />
          </button>
          <button type="button" className="icon-btn" title="Open original">
            <I.Link size={13} />
          </button>
        </div>
        <div className="reader-chrome-right">
          {pct > 0 ? <span className="progress-pill">{pct}% read</span> : null}
          <button
            type="button"
            className={`btn-ai${aiOpen ? ' is-on' : ''}`}
            onClick={onToggleAi}
          >
            <I.Sparkles size={12} />
            AI Chat
          </button>
          <button
            type="button"
            className={`icon-btn${aiOpen ? ' is-accent' : ''}`}
            title="Toggle AI Sidebar"
            onClick={onToggleAi}
          >
            <I.PanelRight size={13} />
          </button>
        </div>
      </header>

      <div className="reader-scroll" ref={readerRef} onMouseUp={onMouseUp}>
        <article className="article">
          <div className="article-meta">
            <span>{item.author}</span>
            <span aria-hidden>·</span>
            <span>{item.time}</span>
            <span aria-hidden>·</span>
            <span>{item.readMins} min</span>
            <span aria-hidden>·</span>
            <span>{item.source}</span>
          </div>
          <div className="article-tags">
            {item.tags.map((t) => (
              <TagChip key={t} name={t} />
            ))}
          </div>
          <h1>{item.title}</h1>
          {item.cover ? <div className="article-cover" style={{ background: item.cover }} /> : null}
          {item.summary ? (
            <div className="ai-summary">
              <div className="ai-summary-label">
                <I.Sparkles size={12} />
                AI Summary
              </div>
              <p>{item.summary}</p>
            </div>
          ) : null}
          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: item.body }}
          />
        </article>
      </div>

      {selectionToolbar ? (
        <div
          className="selection-bar"
          style={{ top: selectionToolbar.top, left: selectionToolbar.left }}
          role="toolbar"
          aria-label="Selection actions"
        >
          {[
            ['translate', '翻译'],
            ['polish', '润色'],
            ['explain', '解释'],
            ['ask', '问 AI'],
            ['continue', '续写'],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => onSelectionAction(id, selectionToolbar.text)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AiSidebar({ open, item, messages, input, onInput, onSend, onClose, onQuick }) {
  if (!open) return null;
  return (
    <aside className="pane ai-pane" data-screen-label="ai-sidebar">
      <header className="chrome-bar ai-chrome">
        <div className="ai-title">
          <I.Sparkles size={13} />
          <span>AI Chat</span>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} title="Close">
          <I.X size={13} />
        </button>
      </header>
      <div className="ai-context">
        {item ? (
          <>
            <div className="ai-context-label">Context</div>
            <div className="ai-context-title">{item.title}</div>
          </>
        ) : (
          <div className="muted">No article selected</div>
        )}
      </div>
      <div className="ai-quick">
        {[
          ['summary', '总结'],
          ['translate', '翻译'],
          ['rewrite', '二次创作'],
          ['tags', '建议标签'],
        ].map(([id, label]) => (
          <button key={id} type="button" className="ai-chip" onClick={() => onQuick(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="ai-messages">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <div className="ai-msg-role">{m.role === 'user' ? 'You' : 'Agent'}</div>
            <div className="ai-msg-body">{m.text}</div>
          </div>
        ))}
      </div>
      <form
        className="ai-compose"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="Ask about this article…"
          aria-label="AI message"
        />
        <button type="submit" className="icon-btn is-accent" disabled={!input.trim()}>
          <I.Send size={13} />
        </button>
      </form>
    </aside>
  );
}

Object.assign(window, {
  TypeIcon,
  typeLabel,
  TagDot,
  TagChip,
  NavRow,
  NavPane,
  ListPane,
  ReaderPane,
  AiSidebar,
});
