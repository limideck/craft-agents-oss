package sites

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var skipDirNames = map[string]bool{
	"node_modules": true,
	".git":         true,
	"dist":         true,
	".vite":        true,
}

// ListFiles returns a tree of files under the site root (skips node_modules/dist/.git).
func ListFiles(siteRoot string) ([]FileNode, error) {
	siteRoot = filepath.Clean(siteRoot)
	info, err := os.Stat(siteRoot)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("site path is not a directory")
	}
	children, err := readDirNodes(siteRoot, "")
	if err != nil {
		return nil, err
	}
	return children, nil
}

func readDirNodes(absDir, relDir string) ([]FileNode, error) {
	entries, err := os.ReadDir(absDir)
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool {
		a, b := entries[i], entries[j]
		if a.IsDir() != b.IsDir() {
			return a.IsDir()
		}
		return strings.ToLower(a.Name()) < strings.ToLower(b.Name())
	})

	out := make([]FileNode, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		if skipDirNames[name] {
			continue
		}
		if strings.HasPrefix(name, ".") && name != ".craft-sites.json" && name != ".gitignore" {
			continue
		}
		rel := name
		if relDir != "" {
			rel = filepath.ToSlash(filepath.Join(relDir, name))
		} else {
			rel = filepath.ToSlash(name)
		}
		node := FileNode{Name: name, Path: rel}
		if e.IsDir() {
			node.Type = "directory"
			kids, err := readDirNodes(filepath.Join(absDir, name), rel)
			if err != nil {
				return nil, err
			}
			node.Children = kids
		} else {
			node.Type = "file"
		}
		out = append(out, node)
	}
	return out, nil
}

func ReadFile(siteRoot, rel string) (string, string, error) {
	abs, err := ResolveSitePath(siteRoot, rel)
	if err != nil {
		return "", "", err
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return "", "", err
	}
	return filepath.ToSlash(filepath.Clean(filepath.FromSlash(rel))), string(data), nil
}

func WriteFile(siteRoot, rel, content string) error {
	abs, err := ResolveSitePath(siteRoot, rel)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, []byte(content), 0o644)
}
