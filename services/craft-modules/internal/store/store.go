package store

import (
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/craft-agent/craft-modules/internal/dates"
	"github.com/craft-agent/craft-modules/internal/model"
)

const ListLimit = 500

const articleCols = `article_id, feed_id, feed_name, title, link, pub_date,
	summary, content, author, audio_url, audio_duration, is_starred, content_updated_at`

var reClock = regexp.MustCompile(`^\d+:\d{2}(:\d{2})?$`)

type Row struct {
	ArticleID        string
	FeedID           sql.NullString
	FeedName         sql.NullString
	Title            sql.NullString
	Link             sql.NullString
	PubDate          sql.NullString
	Summary          sql.NullString
	Content          sql.NullString
	Author           sql.NullString
	AudioURL         sql.NullString
	AudioDuration    sql.NullString
	IsStarred        sql.NullInt64
	ContentUpdatedAt sql.NullInt64
}

func MakeID(link, title, pubDate string) string {
	seed := link
	if seed == "" {
		seed = title + pubDate
	}
	sum := md5.Sum([]byte(seed))
	return hex.EncodeToString(sum[:])[:12]
}

func NormalizeDuration(dur string) string {
	if dur == "" {
		return ""
	}
	if reClock.MatchString(dur) {
		return dur
	}
	i := 0
	if i < len(dur) && (dur[i] == '+' || dur[i] == '-') {
		i++
	}
	start := i
	for i < len(dur) && dur[i] >= '0' && dur[i] <= '9' {
		i++
	}
	if i == start {
		return dur
	}
	secs, err := strconv.Atoi(dur[:i])
	if err != nil {
		return dur
	}
	h := secs / 3600
	m := (secs % 3600) / 60
	s := secs % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%d:%02d", m, s)
}

func RowToArticle(r Row, withContent bool) model.Article {
	a := model.Article{
		ID:            r.ArticleID,
		FeedID:        r.FeedID.String,
		FeedName:      r.FeedName.String,
		Title:         r.Title.String,
		Link:          r.Link.String,
		PubDate:       r.PubDate.String,
		Author:        r.Author.String,
		AudioURL:      r.AudioURL.String,
		AudioDuration: r.AudioDuration.String,
		IsStarred:     r.IsStarred.Valid && r.IsStarred.Int64 != 0,
	}
	if withContent {
		a.Summary = r.Summary.String
		a.Content = r.Content.String
	}
	if r.ContentUpdatedAt.Valid {
		v := r.ContentUpdatedAt.Int64
		a.UpdatedAt = &v
	}
	return a
}

func pubMs(pubDate string) int64 {
	if t, ok := dates.ParsePubDate(pubDate); ok {
		return t.UnixMilli()
	}
	return 0
}

func ByPubDateDesc(arts []model.Article) {
	sort.SliceStable(arts, func(i, j int) bool {
		return pubMs(arts[i].PubDate) > pubMs(arts[j].PubDate)
	})
}

func NormalizePubDates(arts []model.Article) []model.Article {
	for i := range arts {
		if t, ok := dates.ParsePubDate(arts[i].PubDate); ok {
			arts[i].PubDate = dates.ISOString(t.UnixMilli())
		}
	}
	return arts
}

func ToArticles(rows []Row, withContent bool) []model.Article {
	out := make([]model.Article, 0, len(rows))
	for _, r := range rows {
		out = append(out, RowToArticle(r, withContent))
	}
	return out
}

func DigestQuota(feedCount int) int {
	if feedCount == 0 {
		return ListLimit
	}
	q := int(math.Ceil(float64(ListLimit) / float64(feedCount)))
	if q < 1 {
		return 1
	}
	return q
}

func scanArticleRows(rows *sql.Rows) ([]Row, error) {
	defer rows.Close()
	var out []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(
			&r.ArticleID, &r.FeedID, &r.FeedName, &r.Title, &r.Link, &r.PubDate,
			&r.Summary, &r.Content, &r.Author, &r.AudioURL, &r.AudioDuration,
			&r.IsStarred, &r.ContentUpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func ListFeeds(db *sql.DB) ([]model.Feed, error) {
	rows, err := db.Query(`SELECT id, name, url, last_fetched_at FROM feeds ORDER BY rowid`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	feeds := []model.Feed{}
	for rows.Next() {
		var f model.Feed
		var last sql.NullInt64
		if err := rows.Scan(&f.ID, &f.Name, &f.URL, &last); err != nil {
			return nil, err
		}
		if last.Valid {
			v := last.Int64
			f.LastFetchedAt = &v
		}
		feeds = append(feeds, f)
	}
	return feeds, rows.Err()
}

func FeedIDs(db *sql.DB) ([]string, error) {
	rows, err := db.Query(`SELECT id FROM feeds ORDER BY rowid`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func GetFeed(r *sql.DB, id string) (model.Feed, bool, error) {
	var f model.Feed
	var last sql.NullInt64
	err := r.QueryRow(`SELECT id, name, url, last_fetched_at FROM feeds WHERE id = ?`, id).
		Scan(&f.ID, &f.Name, &f.URL, &last)
	if err == sql.ErrNoRows {
		return model.Feed{}, false, nil
	}
	if err != nil {
		return model.Feed{}, false, err
	}
	if last.Valid {
		v := last.Int64
		f.LastFetchedAt = &v
	}
	return f, true, nil
}

func FeedURLExists(r *sql.DB, url string) (bool, error) {
	var one int
	err := r.QueryRow(`SELECT 1 FROM feeds WHERE url = ? LIMIT 1`, url).Scan(&one)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func FeedURLSet(r *sql.DB) (map[string]bool, error) {
	rows, err := r.Query(`SELECT url FROM feeds`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	set := map[string]bool{}
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		set[u] = true
	}
	return set, rows.Err()
}

func IsUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}

func NewestGlobal(db *sql.DB, limit int) ([]Row, error) {
	rows, err := db.Query(`SELECT `+articleCols+` FROM article_states ORDER BY pub_ts DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	return scanArticleRows(rows)
}

func SinceGlobal(db *sql.DB, since int64, limit int) ([]Row, error) {
	rows, err := db.Query(
		`SELECT `+articleCols+` FROM article_states WHERE pub_ts >= ? ORDER BY pub_ts DESC LIMIT ?`,
		since, limit)
	if err != nil {
		return nil, err
	}
	return scanArticleRows(rows)
}

func NewestByFeed(db *sql.DB, feedID string, limit int) ([]Row, error) {
	rows, err := db.Query(
		`SELECT `+articleCols+` FROM article_states WHERE feed_id = ? ORDER BY pub_ts DESC LIMIT ?`,
		feedID, limit)
	if err != nil {
		return nil, err
	}
	return scanArticleRows(rows)
}

func SinceByFeed(db *sql.DB, feedID string, since int64, limit int) ([]Row, error) {
	rows, err := db.Query(
		`SELECT `+articleCols+` FROM article_states WHERE feed_id = ? AND pub_ts >= ? ORDER BY pub_ts DESC LIMIT ?`,
		feedID, since, limit)
	if err != nil {
		return nil, err
	}
	return scanArticleRows(rows)
}

func Starred(db *sql.DB) ([]Row, error) {
	rows, err := db.Query(
		`SELECT ` + articleCols + ` FROM article_states WHERE is_starred = 1 ORDER BY starred_at DESC`)
	if err != nil {
		return nil, err
	}
	return scanArticleRows(rows)
}

func Podcasts(db *sql.DB) ([]Row, error) {
	rows, err := db.Query(
		`SELECT ` + articleCols + ` FROM article_states
		 WHERE audio_url IS NOT NULL AND audio_url != ''
		 ORDER BY pub_date DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	return scanArticleRows(rows)
}

func StarredCount(db *sql.DB) (int64, error) {
	var n int64
	err := db.QueryRow(`SELECT COUNT(*) FROM article_states WHERE is_starred = 1`).Scan(&n)
	return n, err
}

func GetArticle(r *sql.DB, id string) (Row, bool, error) {
	row := r.QueryRow(`SELECT `+articleCols+` FROM article_states WHERE article_id = ?`, id)
	var out Row
	err := row.Scan(
		&out.ArticleID, &out.FeedID, &out.FeedName, &out.Title, &out.Link, &out.PubDate,
		&out.Summary, &out.Content, &out.Author, &out.AudioURL, &out.AudioDuration,
		&out.IsStarred, &out.ContentUpdatedAt,
	)
	if err == sql.ErrNoRows {
		return Row{}, false, nil
	}
	if err != nil {
		return Row{}, false, err
	}
	return out, true, nil
}

func LookupContent(db *sql.DB, id string) (string, error) {
	var content, summary sql.NullString
	err := db.QueryRow(`SELECT content, summary FROM article_states WHERE article_id = ?`, id).Scan(&content, &summary)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if content.String != "" {
		return content.String, nil
	}
	return summary.String, nil
}

func FeedHasRows(db *sql.DB, feedID string) (bool, error) {
	var one int
	err := db.QueryRow(`SELECT 1 FROM article_states WHERE feed_id = ? LIMIT 1`, feedID).Scan(&one)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func ResolveURL(db *sql.DB, url string) (string, error) {
	const scheme = "rsshub://"
	if url == "" || !strings.HasPrefix(url, scheme) {
		return url, nil
	}
	base := "http://localhost:1200"
	var v sql.NullString
	err := db.QueryRow(`SELECT value FROM settings WHERE key = 'rsshub_base_url'`).Scan(&v)
	if err != nil && err != sql.ErrNoRows {
		return "", err
	}
	if v.Valid && v.String != "" {
		base = v.String
	}
	return strings.TrimSuffix(base, "/") + "/" + url[len(scheme):], nil
}

func Search(r *sql.DB, like, scope, feedID string) ([]Row, error) {
	q := `SELECT ` + articleCols + ` FROM article_states
		WHERE (title LIKE ? ESCAPE '\' OR summary LIKE ? ESCAPE '\' OR content LIKE ? ESCAPE '\')`
	args := []any{like, like, like}
	switch {
	case scope == "starred":
		q += ` AND is_starred = 1`
	case scope == "feed" && feedID != "":
		q += ` AND feed_id = ?`
		args = append(args, feedID)
	}
	q += ` ORDER BY pub_date DESC LIMIT 200`
	rows, err := r.Query(q, args...)
	if err != nil {
		return nil, err
	}
	return scanArticleRows(rows)
}

func Settings(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

func EscapeLike(q string) string {
	q = strings.ReplaceAll(q, `\`, `\\`)
	q = strings.ReplaceAll(q, `%`, `\%`)
	q = strings.ReplaceAll(q, `_`, `\_`)
	return "%" + q + "%"
}
