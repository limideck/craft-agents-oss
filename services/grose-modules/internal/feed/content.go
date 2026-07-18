package feed

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	readability "codeberg.org/readeck/go-readability/v2"

	"github.com/grose-agent/grose-modules/internal/ssrf"
)

// fetchContentUA is a browser-like UA — many sites gate article HTML behind it.
const fetchContentUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
	"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const fetchContentTimeout = 15 * time.Second

// ArticleContent is the result of readability extraction.
type ArticleContent struct {
	Content string `json:"content"`
	Title   string `json:"title"`
	Byline  string `json:"byline"`
}

// FetchReadableContent SSRF-guards rawURL, fetches HTML, and extracts readable content.
func FetchReadableContent(ctx context.Context, rawURL string) (*ArticleContent, error) {
	if err := ssrf.AssertSafeURL(ctx, rawURL); err != nil {
		return nil, fmt.Errorf("blocked url: %w", err)
	}
	html, status, err := fetchArticleHTML(ctx, rawURL)
	if err != nil {
		return nil, fmt.Errorf("fetch failed: %w", err)
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("upstream %d", status)
	}
	pageURL, _ := url.Parse(rawURL)
	art, err := readability.FromReader(bytes.NewReader(html), pageURL)
	if err != nil || art.Node == nil {
		return nil, fmt.Errorf("could not extract content")
	}
	var content bytes.Buffer
	if err := art.RenderHTML(&content); err != nil {
		return nil, fmt.Errorf("could not extract content")
	}
	return &ArticleContent{
		Content: content.String(),
		Title:   art.Title(),
		Byline:  art.Byline(),
	}, nil
}

func fetchArticleHTML(ctx context.Context, raw string) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(ctx, fetchContentTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", fetchContentUA)
	req.Header.Set("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
	client := ssrf.HTTPClient(fetchContentTimeout)
	res, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 5<<20)) // 5 MiB cap
	if err != nil {
		return nil, res.StatusCode, err
	}
	return body, res.StatusCode, nil
}
