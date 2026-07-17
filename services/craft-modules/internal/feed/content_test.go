package feed

import (
	"bytes"
	"context"
	"net/url"
	"strings"
	"testing"

	readability "codeberg.org/readeck/go-readability/v2"
)

func TestFetchReadableContentValidation(t *testing.T) {
	ctx := context.Background()

	_, err := FetchReadableContent(ctx, "http://127.0.0.1/secret")
	if err == nil || !strings.Contains(err.Error(), "blocked") {
		t.Fatalf("want blocked error, got %v", err)
	}

	_, err = FetchReadableContent(ctx, "file:///etc/passwd")
	if err == nil {
		t.Fatal("expected error for file scheme")
	}

	_, err = FetchReadableContent(ctx, "ftp://example.com/x")
	if err == nil {
		t.Fatal("expected error for ftp scheme")
	}
}

func TestReadabilityExtractSmoke(t *testing.T) {
	html := `<!doctype html><html><head><title>Hello World</title></head>
<body><article><h1>Hello World</h1>
<p>This is a long enough paragraph for readability extraction to succeed when testing locally with enough content.</p>
<p>Another paragraph with useful content about nothing in particular so the extractor has enough text to work with.</p>
</article></body></html>`
	pageURL, _ := url.Parse("https://example.com/article")
	art, err := readability.FromReader(bytes.NewReader([]byte(html)), pageURL)
	if err != nil || art.Node == nil {
		t.Fatalf("readability extract failed: %v", err)
	}
	var buf bytes.Buffer
	if err := art.RenderHTML(&buf); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if !strings.Contains(out, "Hello World") && !strings.Contains(art.Title(), "Hello") {
		t.Fatalf("expected title/content, got title=%q content=%q", art.Title(), out)
	}
}
