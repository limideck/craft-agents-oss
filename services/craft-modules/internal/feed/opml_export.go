package feed

import (
	"encoding/xml"
	"strings"

	"github.com/craft-agent/craft-modules/internal/model"
)

type exportOutline struct {
	Text   string `xml:"text,attr"`
	Title  string `xml:"title,attr"`
	Type   string `xml:"type,attr"`
	XMLURL string `xml:"xmlUrl,attr"`
	HTMLURL string `xml:"htmlUrl,attr,omitempty"`
}

type exportBody struct {
	Outlines []exportOutline `xml:"outline"`
}

type exportHead struct {
	Title string `xml:"title"`
}

type exportDoc struct {
	XMLName xml.Name   `xml:"opml"`
	Version string     `xml:"version,attr"`
	Head    exportHead `xml:"head"`
	Body    exportBody `xml:"body"`
}

// ExportOPML builds OPML 2.0 XML for the given feeds.
func ExportOPML(feeds []model.Feed) ([]byte, error) {
	outlines := make([]exportOutline, 0, len(feeds))
	for _, f := range feeds {
		name := strings.TrimSpace(f.Name)
		if name == "" {
			name = f.URL
		}
		outlines = append(outlines, exportOutline{
			Text:   name,
			Title:  name,
			Type:   "rss",
			XMLURL: f.URL,
		})
	}
	doc := exportDoc{
		Version: "2.0",
		Head:    exportHead{Title: "Craft RSS subscriptions"},
		Body:    exportBody{Outlines: outlines},
	}
	raw, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), raw...), nil
}
