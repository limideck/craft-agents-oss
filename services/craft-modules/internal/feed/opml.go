package feed

import (
	"encoding/xml"
)

type Candidate struct {
	Name string
	URL  string
}

type opmlOutline struct {
	XMLURL   string        `xml:"xmlUrl,attr"`
	Text     string        `xml:"text,attr"`
	Title    string        `xml:"title,attr"`
	Outlines []opmlOutline `xml:"outline"`
}

type opmlDoc struct {
	XMLName xml.Name      `xml:"opml"`
	Body    []opmlOutline `xml:"body>outline"`
}

func ParseOPML(data []byte) ([]Candidate, error) {
	var doc opmlDoc
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	var out []Candidate
	var walk func(nodes []opmlOutline)
	walk = func(nodes []opmlOutline) {
		for _, n := range nodes {
			if n.XMLURL != "" {
				name := n.Text
				if name == "" {
					name = n.Title
				}
				if name == "" {
					name = n.XMLURL
				}
				out = append(out, Candidate{Name: name, URL: n.XMLURL})
			}
			if len(n.Outlines) > 0 {
				walk(n.Outlines)
			}
		}
	}
	walk(doc.Body)
	return out, nil
}
