package cache

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/craft-agent/craft-modules/internal/db"
	"github.com/craft-agent/craft-modules/internal/feed"
	"github.com/craft-agent/craft-modules/internal/model"
	"github.com/craft-agent/craft-modules/internal/store"
)

const CacheTTL = 5 * time.Minute
const defaultRefreshConcurrency = 2

type Result struct {
	Items    []feed.Item
	FeedName string
}

type FetchFunc func(ctx context.Context, url string) (*feed.Parsed, error)

type Cache struct {
	db    *db.DB
	fetch FetchFunc

	mu       sync.Mutex
	inflight map[string]*flight
	sem      chan struct{}
	now      func() int64
}

type flight struct {
	done chan struct{}
	res  Result
	err  error
}

type Option func(*Cache)

func WithConcurrency(n int) Option {
	return func(c *Cache) {
		if n >= 1 {
			c.sem = make(chan struct{}, n)
		}
	}
}

func New(handle *db.DB, fetch FetchFunc, opts ...Option) *Cache {
	if fetch == nil {
		fetch = feed.ParseURL
	}
	c := &Cache{
		db:       handle,
		fetch:    fetch,
		inflight: map[string]*flight{},
		sem:      make(chan struct{}, defaultRefreshConcurrency),
		now:      func() int64 { return time.Now().UnixMilli() },
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Cache) RefreshFeed(ctx context.Context, f model.Feed) (Result, error) {
	c.mu.Lock()
	if fl, ok := c.inflight[f.ID]; ok {
		c.mu.Unlock()
		<-fl.done
		return fl.res, fl.err
	}
	fl := &flight{done: make(chan struct{})}
	c.inflight[f.ID] = fl
	c.mu.Unlock()

	fl.res, fl.err = c.doRefresh(ctx, f)

	c.mu.Lock()
	delete(c.inflight, f.ID)
	c.mu.Unlock()
	close(fl.done)
	return fl.res, fl.err
}

func (c *Cache) doRefresh(ctx context.Context, f model.Feed) (Result, error) {
	c.sem <- struct{}{}
	defer func() { <-c.sem }()

	target, err := store.ResolveURL(c.db.Reader(), f.URL)
	if err != nil {
		return Result{}, err
	}
	parsed, err := c.fetch(ctx, target)
	if err != nil {
		return Result{}, err
	}
	feedName := f.Name
	if parsed.Title != "" {
		feedName = parsed.Title
	}
	now := c.now()
	if err := store.RefreshPersist(c.db.Writer(), f.ID, feedName, f.URL, parsed.Items, now); err != nil {
		return Result{}, err
	}
	return Result{Items: parsed.Items, FeedName: feedName}, nil
}

func (c *Cache) EnsureFresh(ctx context.Context, f model.Feed) error {
	var last int64
	if f.LastFetchedAt != nil {
		last = *f.LastFetchedAt
	}
	if last != 0 && c.now()-last < CacheTTL.Milliseconds() {
		return nil
	}
	if last != 0 {
		c.backgroundRefresh(f)
		return nil
	}
	hasRows, err := store.FeedHasRows(c.db.Reader(), f.ID)
	if err != nil {
		return err
	}
	if hasRows {
		c.backgroundRefresh(f)
		return nil
	}
	_, err = c.RefreshFeed(ctx, f)
	return err
}

func (c *Cache) backgroundRefresh(f model.Feed) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("background refresh panic", "feedId", f.ID, "panic", r)
			}
		}()
		_, _ = c.RefreshFeed(context.Background(), f)
	}()
}

type WorkspaceCaches struct {
	mu     sync.Mutex
	caches map[string]*Cache
	dbMgr  *db.Manager
}

func NewWorkspaceCaches(mgr *db.Manager) *WorkspaceCaches {
	return &WorkspaceCaches{caches: map[string]*Cache{}, dbMgr: mgr}
}

func (w *WorkspaceCaches) For(workspaceID string) (*Cache, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if c, ok := w.caches[workspaceID]; ok {
		return c, nil
	}
	handle, err := w.dbMgr.Get(workspaceID)
	if err != nil {
		return nil, err
	}
	c := New(handle, nil, WithConcurrency(defaultRefreshConcurrency))
	w.caches[workspaceID] = c
	return c, nil
}

func (w *WorkspaceCaches) Each(fn func(workspaceID string, c *Cache) error) {
	w.mu.Lock()
	ids := make([]string, 0, len(w.caches))
	for id := range w.caches {
		ids = append(ids, id)
	}
	w.mu.Unlock()
	for _, id := range ids {
		c, err := w.For(id)
		if err != nil {
			continue
		}
		_ = fn(id, c)
	}
}
