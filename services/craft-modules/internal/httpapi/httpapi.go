package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/craft-agent/craft-modules/internal/cache"
	"github.com/craft-agent/craft-modules/internal/config"
	"github.com/craft-agent/craft-modules/internal/dates"
	"github.com/craft-agent/craft-modules/internal/db"
	"github.com/craft-agent/craft-modules/internal/feed"
	"github.com/craft-agent/craft-modules/internal/httpx"
	"github.com/craft-agent/craft-modules/internal/mcp"
	"github.com/craft-agent/craft-modules/internal/model"
	"github.com/craft-agent/craft-modules/internal/sites"
	"github.com/craft-agent/craft-modules/internal/store"
	"github.com/craft-agent/craft-modules/internal/workflows"
	"github.com/craft-agent/craft-modules/internal/workspace"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

type ctxKey int

const (
	ctxWorkspaceID ctxKey = iota
	ctxWorkspaceRoot
)

type Server struct {
	DBMgr            *db.Manager
	Caches           *cache.WorkspaceCaches
	WFMgr            *workflows.Manager
	SitesMgr         *sites.Manager
	SitesPreview     *sites.PreviewManager
	Token            string
	DefaultWorkspace string
	Port             int
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(s.noStore)

	r.Get("/health", s.health)

	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Handle("/mcp", mcp.Handler(mcp.Deps{
			Port:             s.Port,
			Token:            s.Token,
			DefaultWorkspace: s.DefaultWorkspace,
		}))
		r.Route("/api/rss", func(r chi.Router) {
			r.Use(s.workspaceMiddleware)
			r.Get("/feeds", s.getFeeds)
			r.Post("/feeds", s.postFeed)
			r.Post("/feeds/import-opml", s.postImportOPML)
			r.Get("/feeds/export-opml", s.getExportOPML)
			r.Patch("/feeds/{id}", s.patchFeed)
			r.Delete("/feeds/{id}", s.deleteFeed)
			r.Get("/articles", s.getArticles)
			r.Get("/articles/fetch-content", s.getFetchContent)
			r.Get("/articles/{id}", s.getArticle)
			r.Post("/articles/star", s.postStar)
			r.Get("/starred/count", s.getStarredCount)
			r.Post("/refresh", s.postRefresh)
			r.Get("/settings", s.getSettings)
			r.Patch("/settings", s.patchSettings)
		})
		r.Route("/api/workflows", func(r chi.Router) {
			r.Use(s.workspaceMiddleware)
			(&workflows.Handler{Mgr: s.WFMgr}).Mount(r)
		})
		r.Route("/api/sites", func(r chi.Router) {
			r.Use(s.workspaceMiddleware)
			(&sites.Handler{Mgr: s.SitesMgr, Preview: s.SitesPreview}).Mount(r)
		})
	})

	return r
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"version": config.Version,
		"modules": []string{"rss", "workflows", "sites"},
	})
}

func (s *Server) noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api") {
			w.Header().Set("Cache-Control", "no-store")
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.Token == "" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		want := "Bearer " + s.Token
		if auth != want {
			httpx.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) workspaceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ws := strings.TrimSpace(r.Header.Get("X-Craft-Workspace-Id"))
		if ws == "" {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "X-Craft-Workspace-Id required"})
			return
		}
		headerRoot := strings.TrimSpace(r.Header.Get(workspace.HeaderRoot))
		root, err := workspace.ResolveRoot(ws, headerRoot)
		if err != nil {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		ctx := context.WithValue(r.Context(), ctxWorkspaceID, ws)
		ctx = context.WithValue(ctx, ctxWorkspaceRoot, root)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) workspaceID(r *http.Request) string {
	if id, ok := r.Context().Value(ctxWorkspaceID).(string); ok && id != "" {
		return id
	}
	return strings.TrimSpace(r.Header.Get("X-Craft-Workspace-Id"))
}

func (s *Server) workspaceRoot(r *http.Request) string {
	if root, ok := r.Context().Value(ctxWorkspaceRoot).(string); ok {
		return root
	}
	return ""
}

func (s *Server) openDB(r *http.Request) (*db.DB, error) {
	return s.DBMgr.Get(s.workspaceID(r), s.workspaceRoot(r))
}

func (s *Server) openCache(r *http.Request) (*cache.Cache, error) {
	return s.Caches.For(s.workspaceID(r), s.workspaceRoot(r))
}

func (s *Server) getFeeds(w http.ResponseWriter, r *http.Request) {
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	feeds, err := store.ListFeeds(handle.Reader())
	if err != nil {
		serverError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=30")
	httpx.WriteJSON(w, http.StatusOK, feeds)
}

func (s *Server) postFeed(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL  string `json:"url"`
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.URL == "" {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "URL required"})
		return
	}
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	exists, err := store.FeedURLExists(handle.Reader(), body.URL)
	if err != nil {
		serverError(w, err)
		return
	}
	if exists {
		httpx.WriteJSON(w, http.StatusConflict, map[string]any{"error": "feed already exists"})
		return
	}
	resolved, err := store.ResolveURL(handle.Reader(), body.URL)
	if err != nil {
		serverError(w, err)
		return
	}
	parsed, err := feed.ParseURL(r.Context(), resolved)
	if err != nil {
		// ParseURL fetches then parses; fetch/SSRF errors are prefixed with "fetch ".
		msg := "failed to parse feed"
		if strings.HasPrefix(err.Error(), "fetch ") {
			msg = "failed to fetch feed"
		}
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"error": msg, "detail": err.Error(),
		})
		return
	}
	feedTitle := feed.TrimName(body.Name)
	if feedTitle == "" {
		feedTitle = feed.TrimName(parsed.Title)
	}
	if feedTitle == "" {
		feedTitle = body.URL
	}
	id := uuid.New().String()
	if err := store.InsertFeed(handle.Writer(), id, feedTitle, body.URL); err != nil {
		if store.IsUniqueViolation(err) {
			httpx.WriteJSON(w, http.StatusConflict, map[string]any{"error": "feed already exists"})
			return
		}
		serverError(w, err)
		return
	}
	if _, err := store.AdoptStarredOrphans(handle.Writer(), id, feedTitle, body.URL); err != nil {
		serverError(w, err)
		return
	}
	c, err := s.openCache(r)
	if err != nil {
		serverError(w, err)
		return
	}
	f := model.Feed{ID: id, Name: feedTitle, URL: body.URL}
	if _, err := c.RefreshFeed(r.Context(), f); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"error": "feed created but fetch failed", "detail": err.Error(),
			"id": id, "name": feedTitle, "url": body.URL,
		})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"id": id, "name": feedTitle, "url": body.URL})
}

func (s *Server) postImportOPML(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OPML string `json:"opml"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.OPML == "" {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "opml content required"})
		return
	}
	candidates, err := feed.ParseOPML([]byte(body.OPML))
	if err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "failed to parse OPML", "detail": err.Error()})
		return
	}
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	existing, err := store.FeedURLSet(handle.Reader())
	if err != nil {
		serverError(w, err)
		return
	}
	imported := []map[string]any{}
	skipped := 0
	for _, c := range candidates {
		if existing[c.URL] {
			skipped++
			continue
		}
		id := uuid.New().String()
		if err := store.InsertFeedIgnore(handle.Writer(), id, c.Name, c.URL); err != nil {
			serverError(w, err)
			return
		}
		if _, err := store.AdoptStarredOrphans(handle.Writer(), id, c.Name, c.URL); err != nil {
			serverError(w, err)
			return
		}
		imported = append(imported, map[string]any{"id": id, "name": c.Name, "url": c.URL})
		existing[c.URL] = true
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"imported": len(imported), "skipped": skipped, "feeds": imported,
	})
}

func (s *Server) getExportOPML(w http.ResponseWriter, r *http.Request) {
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	feeds, err := store.ListFeeds(handle.Reader())
	if err != nil {
		serverError(w, err)
		return
	}
	raw, err := feed.ExportOPML(feeds)
	if err != nil {
		serverError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="feeds.opml"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func (s *Server) getFetchContent(w http.ResponseWriter, r *http.Request) {
	rawURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if rawURL == "" {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "url required"})
		return
	}
	art, err := feed.FetchReadableContent(r.Context(), rawURL)
	if err != nil {
		msg := err.Error()
		switch {
		case strings.Contains(msg, "blocked"):
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Blocked URL", "detail": msg})
		case strings.Contains(msg, "only http") || strings.Contains(msg, "invalid URL"):
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Blocked URL", "detail": msg})
		case strings.Contains(msg, "upstream"):
			httpx.WriteJSON(w, http.StatusBadGateway, map[string]any{"error": msg})
		case strings.Contains(msg, "could not extract"):
			httpx.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": "Could not extract content"})
		case strings.Contains(msg, "fetch failed"):
			httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Fetch failed", "detail": msg})
		default:
			httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Fetch failed", "detail": msg})
		}
		return
	}
	httpx.WriteJSON(w, http.StatusOK, art)
}

func (s *Server) patchFeed(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	name := strings.TrimSpace(body.Name)
	if name == "" {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "name required"})
		return
	}
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	changes, err := store.RenameFeed(handle.Writer(), chi.URLParam(r, "id"), name)
	if err != nil {
		serverError(w, err)
		return
	}
	if changes == 0 {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) deleteFeed(w http.ResponseWriter, r *http.Request) {
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	changes, err := store.DeleteFeed(handle.Writer(), chi.URLParam(r, "id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if changes == 0 {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) getArticles(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	view := q.Get("view")
	if view == "" {
		view = "all"
	}
	mode := q.Get("mode")
	if mode == "" {
		mode = "latest"
	}
	feedID := q.Get("feedId")
	limit := store.ListLimit
	if l := q.Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= store.ListLimit {
			limit = n
		}
	}
	searchQ := strings.TrimSpace(q.Get("q"))

	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	rdb := handle.Reader()

	if searchQ != "" {
		like := store.EscapeLike(searchQ)
		scope := ""
		if view == "starred" {
			scope = "starred"
		} else if view == "feed" && feedID != "" {
			scope = "feed"
		}
		rows, err := store.Search(rdb, like, scope, feedID)
		if err != nil {
			serverError(w, err)
			return
		}
		arts := store.ToArticles(rows, false)
		store.ByPubDateDesc(arts)
		if len(arts) > 100 {
			arts = arts[:100]
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"articles": store.NormalizePubDates(arts)})
		return
	}

	var arts []model.Article
	switch view {
	case "starred":
		rows, err := store.Starred(rdb)
		if err != nil {
			serverError(w, err)
			return
		}
		arts = store.ToArticles(rows, false)
	case "podcast":
		rows, err := store.Podcasts(rdb)
		if err != nil {
			serverError(w, err)
			return
		}
		arts = store.ToArticles(rows, false)
		store.ByPubDateDesc(arts)
		if len(arts) > 100 {
			arts = arts[:100]
		}
	case "feed":
		if feedID == "" {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "feedId required for view=feed"})
			return
		}
		f, ok, err := store.GetFeed(rdb, feedID)
		if err != nil {
			serverError(w, err)
			return
		}
		if !ok {
			httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "feed not found"})
			return
		}
		c, err := s.openCache(r)
		if err != nil {
			serverError(w, err)
			return
		}
		if err := c.EnsureFresh(r.Context(), f); err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to fetch feed", "detail": err.Error()})
			return
		}
		rows, err := store.NewestByFeed(rdb, feedID, limit)
		if err != nil {
			serverError(w, err)
			return
		}
		arts = store.ToArticles(rows, false)
	case "today":
		since := dates.TodayMidnightMs()
		arts, err = s.listArticles(handle, mode, since, limit)
		if err != nil {
			serverError(w, err)
			return
		}
	default:
		arts, err = s.listArticles(handle, mode, 0, limit)
		if err != nil {
			serverError(w, err)
			return
		}
	}

	if len(arts) > limit {
		arts = arts[:limit]
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"articles": store.NormalizePubDates(arts)})
}

func (s *Server) listArticles(handle *db.DB, mode string, since int64, limit int) ([]model.Article, error) {
	rdb := handle.Reader()
	feedIDs, err := store.FeedIDs(rdb)
	if err != nil {
		return nil, err
	}
	if mode == "digest" && len(feedIDs) > 0 {
		quota := store.DigestQuota(len(feedIDs))
		arts := []model.Article{}
		for _, fid := range feedIDs {
			var rows []store.Row
			if since > 0 {
				rows, err = store.SinceByFeed(rdb, fid, since, quota)
			} else {
				rows, err = store.NewestByFeed(rdb, fid, quota)
			}
			if err != nil {
				return nil, err
			}
			for _, row := range rows {
				arts = append(arts, store.RowToArticle(row, false))
			}
		}
		store.ByPubDateDesc(arts)
		if len(arts) > limit {
			arts = arts[:limit]
		}
		return arts, nil
	}
	var rows []store.Row
	if since > 0 {
		rows, err = store.SinceGlobal(rdb, since, limit)
	} else {
		rows, err = store.NewestGlobal(rdb, limit)
	}
	if err != nil {
		return nil, err
	}
	return store.ToArticles(rows, false), nil
}

func (s *Server) getArticle(w http.ResponseWriter, r *http.Request) {
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	row, ok, err := store.GetArticle(handle.Reader(), chi.URLParam(r, "id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, store.NormalizePubDates([]model.Article{store.RowToArticle(row, true)})[0])
}

func (s *Server) postStar(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Article model.Article `json:"article"`
		Starred bool          `json:"starred"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Article.ID == "" {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "article required"})
		return
	}
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	if body.Article.Content == "" {
		if c, err := store.LookupContent(handle.Reader(), body.Article.ID); err == nil {
			body.Article.Content = c
		}
	}
	isStarred := 0
	if body.Starred {
		isStarred = 1
	}
	if err := store.SaveState(handle.Writer(), body.Article, isStarred, time.Now().UnixMilli()); err != nil {
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "isStarred": body.Starred})
}

func (s *Server) getStarredCount(w http.ResponseWriter, r *http.Request) {
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	n, err := store.StarredCount(handle.Reader())
	if err != nil {
		serverError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=10")
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"count": n})
}

func (s *Server) postRefresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FeedID string `json:"feedId"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	c, err := s.openCache(r)
	if err != nil {
		serverError(w, err)
		return
	}

	if body.FeedID != "" {
		f, ok, err := store.GetFeed(handle.Reader(), body.FeedID)
		if err != nil {
			serverError(w, err)
			return
		}
		if !ok {
			httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "feed not found"})
			return
		}
		if _, err := c.RefreshFeed(r.Context(), f); err != nil {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "refresh failed", "detail": err.Error()})
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "refreshed": 1})
		return
	}

	feeds, err := store.ListFeeds(handle.Reader())
	if err != nil {
		serverError(w, err)
		return
	}
	refreshed := 0
	var lastErr error
	for _, f := range feeds {
		if _, err := c.RefreshFeed(r.Context(), f); err != nil {
			lastErr = err
			continue
		}
		refreshed++
	}
	if refreshed == 0 && lastErr != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "refresh failed", "detail": lastErr.Error()})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "refreshed": refreshed})
}

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	settings, err := store.Settings(handle.Reader())
	if err != nil {
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, settings)
}

func (s *Server) patchSettings(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body = map[string]any{}
	}
	handle, err := s.openDB(r)
	if err != nil {
		serverError(w, err)
		return
	}
	for _, key := range []string{"rsshub_base_url"} {
		if v, ok := body[key]; ok {
			if err := store.UpdateSetting(handle.Writer(), key, strings.TrimSpace(fmt.Sprint(v))); err != nil {
				serverError(w, err)
				return
			}
		}
	}
	if err := store.ClearFeedFreshness(handle.Writer()); err != nil {
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func serverError(w http.ResponseWriter, err error) {
	httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
}
