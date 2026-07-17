package sites

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

//go:embed all:templates/blank all:templates/landing all:templates/website
var templateFS embed.FS

// Scaffold copies an embedded Vite+React+TS+Tailwind template into destDir.
// Dependency install is deferred to preview start / sites_run_command.
func Scaffold(destDir string, tmpl Template) error {
	tmpl = NormalizeTemplate(tmpl)
	srcRoot := "templates/" + string(tmpl)

	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return err
	}

	return fs.WalkDir(templateFS, srcRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcRoot, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		rel = filepath.FromSlash(rel)
		target := filepath.Join(destDir, rel)

		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := templateFS.ReadFile(path)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
}

// ResolveSitePath joins site root with a relative path, rejecting traversal.
func ResolveSitePath(siteRoot, rel string) (string, error) {
	rel = strings.TrimSpace(rel)
	if rel == "" {
		return "", fmt.Errorf("path required")
	}
	rel = filepath.Clean(filepath.FromSlash(rel))
	if rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", fmt.Errorf("invalid path")
	}
	abs := filepath.Join(siteRoot, rel)
	siteRootClean := filepath.Clean(siteRoot)
	if abs != siteRootClean && !strings.HasPrefix(abs, siteRootClean+string(os.PathSeparator)) {
		return "", fmt.Errorf("path escapes site root")
	}
	return abs, nil
}
