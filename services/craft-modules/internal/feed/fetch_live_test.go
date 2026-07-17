//go:build live

package feed_test

import (
	"context"
	"testing"
	"time"

	"github.com/craft-agent/craft-modules/internal/feed"
)

func TestLiveParseSspaiFeed(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	parsed, err := feed.ParseURL(ctx, "https://sspai.com/feed")
	if err != nil {
		t.Fatalf("ParseURL: %v", err)
	}
	if parsed.Title == "" {
		t.Fatal("empty title")
	}
	if len(parsed.Items) == 0 {
		t.Fatal("expected items")
	}
	t.Logf("title=%q items=%d", parsed.Title, len(parsed.Items))
}
