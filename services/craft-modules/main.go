package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/craft-agent/craft-modules/internal/cache"
	"github.com/craft-agent/craft-modules/internal/config"
	"github.com/craft-agent/craft-modules/internal/db"
	"github.com/craft-agent/craft-modules/internal/httpapi"
	"github.com/craft-agent/craft-modules/internal/jobs"
	"github.com/craft-agent/craft-modules/internal/workflows"

	_ "modernc.org/sqlite"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	slog.SetDefault(logger)

	if cfg.Port == 0 {
		logger.Error("PORT must be set (flag --port or env PORT)")
		os.Exit(1)
	}
	if cfg.WorkspacesRoot == "" {
		logger.Error("workspaces root not configured (CRAFT_WORKSPACES_ROOT)")
		os.Exit(1)
	}

	dbMgr := db.NewManager()
	caches := cache.NewWorkspaceCaches(dbMgr)
	wfMgr := workflows.NewManager()

	srv := &httpapi.Server{
		DBMgr:            dbMgr,
		Caches:           caches,
		WFMgr:            wfMgr,
		Token:            cfg.Token,
		DefaultWorkspace: cfg.DefaultWorkspace,
		Port:             cfg.Port,
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	poller := &jobs.Poller{DBMgr: dbMgr, Caches: caches, Log: logger}
	poller.Start(ctx)

	addr := "127.0.0.1:" + strconv.Itoa(cfg.Port)
	httpSrv := &http.Server{Addr: addr, Handler: srv.Router()}

	go func() {
		logger.Info("craft-modules listening", "addr", addr, "workspacesRoot", cfg.WorkspacesRoot, "version", config.Version)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	logger.Info("shutting down")
	cancel()
	_ = httpSrv.Shutdown(context.Background())
}
