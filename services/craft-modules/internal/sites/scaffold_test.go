package sites

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScaffoldAndListFiles(t *testing.T) {
	dir := t.TempDir()
	if err := Scaffold(dir, TemplateLanding); err != nil {
		t.Fatal(err)
	}
	for _, rel := range []string{
		"package.json",
		"src/App.tsx",
		"vite.config.ts",
		".craft-sites.json",
		".agents/skills/website-layout/SKILL.md",
		".agents/skills/component-spec/SKILL.md",
		".agents/skills/design-workflow/SKILL.md",
	} {
		if _, err := os.Stat(filepath.Join(dir, filepath.FromSlash(rel))); err != nil {
			t.Fatalf("missing %s: %v", rel, err)
		}
	}
	tree, err := ListFiles(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tree) == 0 {
		t.Fatal("expected non-empty file tree")
	}

	abs, err := ResolveSitePath(dir, "src/App.tsx")
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(abs) != "App.tsx" {
		t.Fatalf("unexpected path %s", abs)
	}
	if _, err := ResolveSitePath(dir, "../etc/passwd"); err == nil {
		t.Fatal("expected traversal rejection")
	}
}

func TestSlugify(t *testing.T) {
	if got := slugify("Hello World!"); got != "hello-world" {
		t.Fatalf("got %q", got)
	}
	if got := slugify("!!!"); got != "site" {
		t.Fatalf("got %q", got)
	}
}
