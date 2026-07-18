package jobs

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/grose-agent/grose-modules/internal/cache"
	"github.com/grose-agent/grose-modules/internal/db"
	"github.com/grose-agent/grose-modules/internal/store"
)

const (
	pollInterval = 15 * time.Minute
	pollStartDelay = 5 * time.Second
)

type Poller struct {
	DBMgr  *db.Manager
	Caches *cache.WorkspaceCaches
	Log    *slog.Logger
}

func (p *Poller) Start(ctx context.Context) {
	go func() {
		select {
		case <-ctx.Done():
			return
		case <-time.After(pollStartDelay):
		}
		p.pollOnce(ctx)
		t := time.NewTicker(pollInterval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				p.pollOnce(ctx)
			}
		}
	}()
}

func (p *Poller) pollOnce(ctx context.Context) {
	p.Caches.Each(func(workspaceID string, c *cache.Cache) error {
		handle, err := p.DBMgr.Get(workspaceID, "")
		if err != nil {
			p.Log.Warn("poll: open db failed", "workspace", workspaceID, "err", err)
			return nil
		}
		feeds, err := store.ListFeeds(handle.Reader())
		if err != nil {
			p.Log.Warn("poll: list feeds failed", "workspace", workspaceID, "err", err)
			return nil
		}
		var wg sync.WaitGroup
		for _, f := range feeds {
			if ctx.Err() != nil {
				break
			}
			f := f
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() {
					if r := recover(); r != nil {
						p.Log.Error("feed poll panic", "feedId", f.ID, "panic", r)
					}
				}()
				if _, err := c.RefreshFeed(ctx, f); err != nil {
					p.Log.Warn("feed poll failed", "workspace", workspaceID, "feedId", f.ID, "err", err)
				}
			}()
		}
		wg.Wait()
		return nil
	})
}
