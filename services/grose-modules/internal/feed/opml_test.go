package feed

import (
	"strings"
	"testing"

	"github.com/grose-agent/grose-modules/internal/model"
)

func TestOPMLRoundtrip(t *testing.T) {
	feeds := []model.Feed{
		{ID: "1", Name: "Alpha", URL: "https://example.com/a.xml"},
		{ID: "2", Name: "Beta", URL: "https://example.com/b.xml"},
	}
	raw, err := ExportOPML(feeds)
	if err != nil {
		t.Fatal(err)
	}
	opml := string(raw)
	if !strings.HasPrefix(opml, "<?xml") {
		t.Fatalf("missing xml header: %q", opml[:min(40, len(opml))])
	}
	if !strings.Contains(opml, `xmlUrl="https://example.com/a.xml"`) {
		t.Fatalf("missing feed url in export:\n%s", opml)
	}

	parsed, err := ParseOPML(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed) != 2 {
		t.Fatalf("want 2 candidates, got %d", len(parsed))
	}
	byURL := map[string]string{}
	for _, c := range parsed {
		byURL[c.URL] = c.Name
	}
	if byURL["https://example.com/a.xml"] != "Alpha" {
		t.Fatalf("Alpha name: got %q", byURL["https://example.com/a.xml"])
	}
	if byURL["https://example.com/b.xml"] != "Beta" {
		t.Fatalf("Beta name: got %q", byURL["https://example.com/b.xml"])
	}
}

func TestParseOPMLEmpty(t *testing.T) {
	got, err := ParseOPML([]byte(`<?xml version="1.0"?><opml version="2.0"><body></body></opml>`))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("want 0, got %d", len(got))
	}
}
