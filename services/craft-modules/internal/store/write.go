package store

import (
	"database/sql"
	"strconv"
	"strings"

	"github.com/craft-agent/craft-modules/internal/dates"
	"github.com/craft-agent/craft-modules/internal/db"
	"github.com/craft-agent/craft-modules/internal/feed"
	"github.com/craft-agent/craft-modules/internal/model"
)

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

const upsertPolledArticleSQL = `
  INSERT INTO article_states
    (article_id,feed_id,feed_name,feed_url,title,link,pub_date,pub_ts,summary,content,author,audio_url,audio_duration,is_starred)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)
  ON CONFLICT(article_id) DO UPDATE SET
    title          = excluded.title,
    pub_date       = excluded.pub_date,
    pub_ts         = excluded.pub_ts,
    summary        = excluded.summary,
    content        = excluded.content,
    author         = excluded.author,
    audio_url      = COALESCE(excluded.audio_url, audio_url),
    audio_duration = COALESCE(excluded.audio_duration, audio_duration),
    updated_at     = CAST(strftime('%s','now') AS INTEGER) * 1000,
    content_updated_at = ?
  WHERE title <> excluded.title
     OR summary <> excluded.summary
     OR content <> excluded.content
     OR author <> excluded.author
     OR pub_date <> excluded.pub_date`

type preparer interface {
	Prepare(query string) (*sql.Stmt, error)
}

func RefreshPersist(w *sql.DB, feedID, feedName, feedURL string, items []feed.Item, now int64) error {
	return db.WithBusyRetry(func() error {
		tx, err := w.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback() //nolint:errcheck
		if err := persistRows(tx, feedID, feedName, feedURL, items, now); err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE feeds SET last_fetched_at = ? WHERE id = ?`, now, feedID); err != nil {
			return err
		}
		return tx.Commit()
	})
}

func persistRows(p preparer, feedID, feedName, feedURL string, items []feed.Item, now int64) error {
	stmt, err := p.Prepare(upsertPolledArticleSQL)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for i, it := range items {
		pubForID := it.PubDate
		if pubForID == "" {
			pubForID = strconv.Itoa(i)
		}
		id := MakeID(it.Link, it.Title, pubForID)
		title := it.Title
		if title == "" {
			title = "Untitled"
		}
		audioURL := ""
		if it.EnclosureURL != "" && strings.HasPrefix(it.EnclosureType, "audio") {
			audioURL = it.EnclosureURL
		}
		audioDuration := ""
		if audioURL != "" {
			audioDuration = NormalizeDuration(it.ItunesDuration)
		}
		if _, err := stmt.Exec(
			id, feedID, feedName, feedURL, title, it.Link, it.PubDate,
			dates.PubTs(it.PubDate, now), it.Summary, it.Content, it.Author,
			nullIfEmpty(audioURL), nullIfEmpty(audioDuration), now,
		); err != nil {
			return err
		}
	}
	return nil
}

func SaveState(w *sql.DB, a model.Article, isStarred int, now int64) error {
	return db.WithBusyRetry(func() error {
		var starredAt any
		if isStarred == 1 {
			starredAt = now
		}
		_, err := w.Exec(
			`INSERT INTO article_states
		   (article_id,feed_id,feed_name,feed_url,title,link,pub_date,pub_ts,summary,content,author,audio_url,audio_duration,is_starred,starred_at)
		 VALUES (?,?,?,(SELECT url FROM feeds WHERE id = ?),?,?,?,?,?,?,?,?,?,?,?)
		 ON CONFLICT(article_id) DO UPDATE SET
		   audio_url      = COALESCE(excluded.audio_url, audio_url),
		   audio_duration = COALESCE(excluded.audio_duration, audio_duration),
		   is_starred = CASE WHEN excluded.is_starred IS NOT NULL THEN excluded.is_starred ELSE is_starred END,
		   starred_at = CASE WHEN excluded.is_starred = 1 THEN excluded.starred_at ELSE starred_at END,
		   updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000`,
			a.ID, a.FeedID, a.FeedName, a.FeedID, a.Title, a.Link, a.PubDate,
			dates.PubTs(a.PubDate, now), a.Summary, a.Content, a.Author,
			nullIfEmpty(a.AudioURL), nullIfEmpty(a.AudioDuration), isStarred, starredAt,
		)
		return err
	})
}

func UpdateSetting(w *sql.DB, key, value string) error {
	return db.WithBusyRetry(func() error {
		_, err := w.Exec(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value)
		return err
	})
}

func ClearFeedFreshness(w *sql.DB) error {
	return db.WithBusyRetry(func() error {
		_, err := w.Exec(`UPDATE feeds SET last_fetched_at = NULL`)
		return err
	})
}

func InsertFeed(w *sql.DB, id, name, url string) error {
	return db.WithBusyRetry(func() error {
		_, err := w.Exec(`INSERT INTO feeds (id, name, url) VALUES (?, ?, ?)`, id, name, url)
		return err
	})
}

func InsertFeedIgnore(w *sql.DB, id, name, url string) error {
	return db.WithBusyRetry(func() error {
		_, err := w.Exec(`INSERT OR IGNORE INTO feeds (id, name, url) VALUES (?, ?, ?)`, id, name, url)
		return err
	})
}

func RenameFeed(w *sql.DB, id, name string) (int64, error) {
	var changes int64
	err := db.WithBusyRetry(func() error {
		res, err := w.Exec(`UPDATE feeds SET name = ? WHERE id = ?`, name, id)
		if err != nil {
			return err
		}
		changes, err = res.RowsAffected()
		return err
	})
	return changes, err
}

func DeleteFeed(w *sql.DB, id string) (int64, error) {
	var changes int64
	err := db.WithBusyRetry(func() error {
		tx, err := w.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback() //nolint:errcheck
		res, err := tx.Exec(`DELETE FROM feeds WHERE id = ?`, id)
		if err != nil {
			return err
		}
		changes, err = res.RowsAffected()
		if err != nil {
			return err
		}
		if changes == 0 {
			return tx.Commit()
		}
		if _, err := tx.Exec(`DELETE FROM article_states WHERE feed_id = ? AND is_starred = 0`, id); err != nil {
			return err
		}
		return tx.Commit()
	})
	return changes, err
}

func AdoptStarredOrphans(w *sql.DB, feedID, feedName, url string) (int64, error) {
	var changes int64
	err := db.WithBusyRetry(func() error {
		res, err := w.Exec(
			`UPDATE article_states SET feed_id = ?, feed_name = ?
		 WHERE feed_url = ? AND is_starred = 1 AND feed_id NOT IN (SELECT id FROM feeds)`,
			feedID, feedName, url)
		if err != nil {
			return err
		}
		changes, err = res.RowsAffected()
		return err
	})
	return changes, err
}
