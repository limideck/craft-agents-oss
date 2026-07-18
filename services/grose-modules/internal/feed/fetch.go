package feed

import (
	"bytes"
	"context"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/grose-agent/grose-modules/internal/dates"
	"github.com/grose-agent/grose-modules/internal/ssrf"
	"github.com/mmcdole/gofeed"
)

type Item struct {
	Link           string
	Title          string
	PubDate        string
	Content        string
	Summary        string
	Author         string
	EnclosureURL   string
	EnclosureType  string
	ItunesDuration string
}

type Parsed struct {
	Title string
	Items []Item
}

const fetchTimeout = 30 * time.Second

var (
	reBlockTag = regexp.MustCompile(`([^\n])</?(h|br|p|ul|ol|li|blockquote|section|table|tr|div)[\s\S]*?>([^\n])`)
	reAnyTag   = regexp.MustCompile(`<[\s\S]*?>`)
)

func stripHTML(s string) string {
	s = reBlockTag.ReplaceAllString(s, "${1}\n${3}")
	s = reAnyTag.ReplaceAllString(s, "")
	return s
}

func getSnippet(s string) string {
	return strings.TrimSpace(html.UnescapeString(stripHTML(s)))
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func mapItem(gi *gofeed.Item, atom bool) Item {
	content := firstNonEmpty(gi.Content, gi.Description)
	snipBase := gi.Description
	if atom {
		snipBase = gi.Content
	}
	summary := getSnippet(snipBase)
	if summary == "" && atom {
		summary = gi.Description
	}
	pubDate := gi.Published
	if atom {
		pubDate = ""
		if gi.PublishedParsed != nil {
			pubDate = dates.ISOString(gi.PublishedParsed.UnixMilli())
		}
	}
	author := ""
	if gi.DublinCoreExt != nil && len(gi.DublinCoreExt.Creator) > 0 {
		author = gi.DublinCoreExt.Creator[0]
	}
	if author == "" && len(gi.Authors) > 0 && gi.Authors[0] != nil {
		author = gi.Authors[0].Name
	}
	encURL, encType := "", ""
	if len(gi.Enclosures) > 0 && gi.Enclosures[0] != nil {
		encURL = gi.Enclosures[0].URL
		encType = gi.Enclosures[0].Type
	}
	dur := ""
	if gi.ITunesExt != nil {
		dur = gi.ITunesExt.Duration
	}
	return Item{
		Link: gi.Link, Title: gi.Title, PubDate: pubDate, Content: content,
		Summary: summary, Author: author, EnclosureURL: encURL, EnclosureType: encType,
		ItunesDuration: dur,
	}
}

func ParseBytes(data []byte) (*Parsed, error) {
	fp := gofeed.NewParser()
	f, err := fp.Parse(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	atom := f.FeedType == "atom"
	items := make([]Item, 0, len(f.Items))
	for _, gi := range f.Items {
		items = append(items, mapItem(gi, atom))
	}
	return &Parsed{Title: f.Title, Items: items}, nil
}

func ParseURL(ctx context.Context, url string) (*Parsed, error) {
	target := strings.TrimSuffix(url, "/")
	if err := ssrf.AssertSafeURL(ctx, target); err != nil {
		return nil, fmt.Errorf("fetch blocked: %w", err)
	}
	data, err := fetchXML(ctx, target)
	if err != nil {
		return nil, err
	}
	return ParseBytes(data)
}

func fetchXML(ctx context.Context, url string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, fetchTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "grose-modules/0.1")
	req.Header.Set("Accept", "*/*")
	client := ssrf.HTTPClient(fetchTimeout)
	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch failed: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("fetch failed: status code %d", res.StatusCode)
	}
	return io.ReadAll(res.Body)
}

func TrimName(s string) string { return strings.TrimSpace(s) }
