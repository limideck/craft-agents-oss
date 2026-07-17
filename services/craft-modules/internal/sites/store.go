package sites

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode"

	craftdb "github.com/craft-agent/craft-modules/internal/db"
	"github.com/google/uuid"
)

func nowMs() int64 {
	return time.Now().UnixMilli()
}

func nullInt(p *int) sql.NullInt64 {
	if p == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: int64(*p), Valid: true}
}

func nullStr(p *string) sql.NullString {
	if p == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *p, Valid: true}
}

func intPtr(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

func strPtr(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	s := n.String
	return &s
}

type siteRow struct {
	id, name, slug, template, path, status string
	previewPort                            sql.NullInt64
	previewURL, sessionID                  sql.NullString
	createdAt, updatedAt                   int64
}

func rowToSite(r siteRow) Site {
	return Site{
		ID:          r.id,
		Name:        r.name,
		Slug:        r.slug,
		Template:    Template(r.template),
		Path:        r.path,
		PreviewPort: intPtr(r.previewPort),
		PreviewURL:  strPtr(r.previewURL),
		Status:      Status(r.status),
		SessionID:   strPtr(r.sessionID),
		CreatedAt:   r.createdAt,
		UpdatedAt:   r.updatedAt,
	}
}

const selectSiteCols = `id, name, slug, template, path, preview_port, preview_url, status, session_id, created_at, updated_at`

func scanSiteRow(scanner interface {
	Scan(dest ...any) error
}) (siteRow, error) {
	var r siteRow
	err := scanner.Scan(
		&r.id, &r.name, &r.slug, &r.template, &r.path,
		&r.previewPort, &r.previewURL, &r.status, &r.sessionID,
		&r.createdAt, &r.updatedAt,
	)
	return r, err
}

func List(rdb *sql.DB) ([]Site, error) {
	var out []Site
	err := craftdb.WithBusyRetry(func() error {
		rows, err := rdb.Query(`SELECT ` + selectSiteCols + ` FROM sites ORDER BY updated_at DESC`)
		if err != nil {
			return err
		}
		defer rows.Close()
		out = []Site{}
		for rows.Next() {
			r, err := scanSiteRow(rows)
			if err != nil {
				return err
			}
			out = append(out, rowToSite(r))
		}
		return rows.Err()
	})
	return out, err
}

func Get(rdb *sql.DB, id string) (Site, bool, error) {
	var site Site
	var found bool
	err := craftdb.WithBusyRetry(func() error {
		row := rdb.QueryRow(`SELECT `+selectSiteCols+` FROM sites WHERE id = ?`, id)
		r, err := scanSiteRow(row)
		if err == sql.ErrNoRows {
			found = false
			return nil
		}
		if err != nil {
			return err
		}
		site = rowToSite(r)
		found = true
		return nil
	})
	return site, found, err
}

func GetBySlug(rdb *sql.DB, slug string) (Site, bool, error) {
	var site Site
	var found bool
	err := craftdb.WithBusyRetry(func() error {
		row := rdb.QueryRow(`SELECT `+selectSiteCols+` FROM sites WHERE slug = ?`, slug)
		r, err := scanSiteRow(row)
		if err == sql.ErrNoRows {
			found = false
			return nil
		}
		if err != nil {
			return err
		}
		site = rowToSite(r)
		found = true
		return nil
	})
	return site, found, err
}

var slugSanitize = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	var b strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(unicode.ToLower(r))
		} else if unicode.IsSpace(r) || r == '-' || r == '_' {
			b.WriteByte('-')
		}
	}
	s = slugSanitize.ReplaceAllString(b.String(), "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "site"
	}
	if len(s) > 48 {
		s = s[:48]
		s = strings.Trim(s, "-")
	}
	return s
}

func uniqueSlug(rdb *sql.DB, base string) (string, error) {
	candidate := base
	for i := 0; i < 100; i++ {
		_, exists, err := GetBySlug(rdb, candidate)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, i+2)
	}
	return "", fmt.Errorf("could not allocate unique slug")
}

func NormalizeTemplate(t Template) Template {
	switch t {
	case TemplateLanding, TemplateWebsite:
		return t
	default:
		return TemplateBlank
	}
}

func Create(wdb *sql.DB, rootPath string, in CreateInput) (Site, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return Site{}, fmt.Errorf("name required")
	}
	tmpl := NormalizeTemplate(in.Template)
	base := slugify(name)
	slug, err := uniqueSlug(wdb, base)
	if err != nil {
		return Site{}, err
	}

	id := uuid.New().String()
	absPath := filepath.Join(SitesDir(rootPath), slug)
	now := nowMs()

	if err := Scaffold(absPath, tmpl); err != nil {
		_ = os.RemoveAll(absPath)
		return Site{}, fmt.Errorf("scaffold: %w", err)
	}

	site := Site{
		ID:        id,
		Name:      name,
		Slug:      slug,
		Template:  tmpl,
		Path:      absPath,
		Status:    StatusReady,
		SessionID: in.SessionID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	_ = writeCraftMeta(absPath, site)

	err = craftdb.WithBusyRetry(func() error {
		_, err := wdb.Exec(`
INSERT INTO sites (id, name, slug, template, path, preview_port, preview_url, status, session_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
			site.ID, site.Name, site.Slug, string(site.Template), site.Path,
			string(site.Status), nullStr(site.SessionID), site.CreatedAt, site.UpdatedAt,
		)
		return err
	})
	if err != nil {
		_ = os.RemoveAll(absPath)
		return Site{}, err
	}
	return site, nil
}

type storeUpdate struct {
	Name         *string
	SessionID    *string
	ClearSession bool
	Status       *Status
	PreviewPort  *int
	ClearPreview bool
	PreviewURL   *string
}

func Update(wdb *sql.DB, id string, in storeUpdate) (Site, bool, error) {
	existing, ok, err := Get(wdb, id)
	if err != nil || !ok {
		return Site{}, ok, err
	}

	name := existing.Name
	if in.Name != nil {
		trimmed := strings.TrimSpace(*in.Name)
		if trimmed == "" {
			return Site{}, true, fmt.Errorf("name required")
		}
		name = trimmed
	}

	sessionID := existing.SessionID
	if in.ClearSession {
		sessionID = nil
	} else if in.SessionID != nil {
		sessionID = in.SessionID
	}

	status := existing.Status
	if in.Status != nil {
		status = *in.Status
	}

	previewPort := existing.PreviewPort
	previewURL := existing.PreviewURL
	if in.ClearPreview {
		previewPort = nil
		previewURL = nil
	} else {
		if in.PreviewPort != nil {
			previewPort = in.PreviewPort
		}
		if in.PreviewURL != nil {
			previewURL = in.PreviewURL
		}
	}

	updatedAt := nowMs()
	err = craftdb.WithBusyRetry(func() error {
		_, err := wdb.Exec(`
UPDATE sites SET name = ?, status = ?, session_id = ?, preview_port = ?, preview_url = ?, updated_at = ?
WHERE id = ?`,
			name, string(status), nullStr(sessionID), nullInt(previewPort), nullStr(previewURL), updatedAt, id,
		)
		return err
	})
	if err != nil {
		return Site{}, true, err
	}
	return Get(wdb, id)
}

func Delete(wdb *sql.DB, id string) (Site, bool, error) {
	site, ok, err := Get(wdb, id)
	if err != nil || !ok {
		return Site{}, ok, err
	}
	err = craftdb.WithBusyRetry(func() error {
		_, err := wdb.Exec(`DELETE FROM sites WHERE id = ?`, id)
		return err
	})
	if err != nil {
		return Site{}, true, err
	}
	return site, true, nil
}

func SetPreview(wdb *sql.DB, id string, port int, url string, status Status) (Site, bool, error) {
	return Update(wdb, id, storeUpdate{
		Status:      &status,
		PreviewPort: &port,
		PreviewURL:  &url,
	})
}

func ClearPreview(wdb *sql.DB, id string, status Status) (Site, bool, error) {
	return Update(wdb, id, storeUpdate{
		Status:       &status,
		ClearPreview: true,
	})
}

func writeCraftMeta(dir string, site Site) error {
	meta := map[string]any{
		"id":       site.ID,
		"name":     site.Name,
		"slug":     site.Slug,
		"template": site.Template,
	}
	b, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, ".craft-sites.json"), append(b, '\n'), 0o644)
}
