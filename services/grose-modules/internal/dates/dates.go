package dates

import (
	"regexp"
	"strings"
	"time"
)

var (
	zonedLayouts = []string{
		time.RFC3339Nano,
		time.RFC3339,
		"Mon, 02 Jan 2006 15:04:05 -0700",
		"Mon, 2 Jan 2006 15:04:05 -0700",
		"Mon, 02 Jan 2006 15:04:05 MST",
		"Mon, 2 Jan 2006 15:04:05 MST",
		"02 Jan 2006 15:04:05 -0700",
		"2 Jan 2006 15:04:05 -0700",
		"02 Jan 2006 15:04:05 MST",
		"2 Jan 2006 15:04:05 MST",
		"2006-01-02T15:04:05-0700",
		"2006-01-02 15:04:05 -0700",
		"2006-01-02 15:04:05 -07:00",
	}
	localLayouts = []string{
		"2006-01-02T15:04:05.000",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"Mon, 02 Jan 2006 15:04:05",
		"Mon, 2 Jan 2006 15:04:05",
		"02 Jan 2006 15:04:05",
		"2 Jan 2006 15:04:05",
		"2006-01-02",
	}
	reWhitespace = regexp.MustCompile(`\s+`)
	reDateSpace  = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2}) `)
	reOffset     = regexp.MustCompile(` ?([+-]\d{2})(\d{2})$`)
)

func ParsePubDate(dateStr string) (time.Time, bool) {
	if dateStr == "" {
		return time.Time{}, false
	}
	if t, ok := tryLayouts(dateStr); ok {
		return t, true
	}
	n := reWhitespace.ReplaceAllString(strings.TrimSpace(dateStr), " ")
	n = reDateSpace.ReplaceAllString(n, "${1}T")
	n = reOffset.ReplaceAllString(n, "${1}:${2}")
	if n != dateStr {
		if t, ok := tryLayouts(n); ok {
			return t, true
		}
	}
	return time.Time{}, false
}

func tryLayouts(s string) (time.Time, bool) {
	for _, l := range zonedLayouts {
		if t, err := time.Parse(l, s); err == nil {
			return t, true
		}
	}
	for _, l := range localLayouts {
		if t, err := time.ParseInLocation(l, s, time.Local); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func PubTs(pubDate string, fallback int64) int64 {
	if t, ok := ParsePubDate(pubDate); ok {
		return t.UnixMilli()
	}
	return fallback
}

func ISOString(ms int64) string {
	return time.UnixMilli(ms).UTC().Format("2006-01-02T15:04:05.000Z07:00")
}

func TodayMidnightMs() int64 {
	now := time.Now()
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return midnight.UnixMilli()
}
