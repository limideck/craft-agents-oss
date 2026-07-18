package sites

import (
	"fmt"
	"os"
	"strings"
)

// ApplyVisualEdits applies text/style patches to a site source file.
// MVP: text edits replace oldValue → newValue (or inject newValue near line);
// style edits replace property assignments or append inline style snippets.
func ApplyVisualEdits(siteRoot, rel string, edits []VisualEdit) error {
	abs, err := ResolveSitePath(siteRoot, rel)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return err
	}
	content := string(data)
	for i, edit := range edits {
		next, err := applyOneEdit(content, edit)
		if err != nil {
			return fmt.Errorf("edit[%d]: %w", i, err)
		}
		content = next
	}
	return os.WriteFile(abs, []byte(content), 0o644)
}

func applyOneEdit(content string, edit VisualEdit) (string, error) {
	switch strings.ToLower(strings.TrimSpace(edit.Type)) {
	case "text":
		return applyTextEdit(content, edit)
	case "style":
		return applyStyleEdit(content, edit)
	default:
		return "", fmt.Errorf("unsupported edit type %q", edit.Type)
	}
}

func applyTextEdit(content string, edit VisualEdit) (string, error) {
	if edit.OldValue != nil && *edit.OldValue != "" {
		if !strings.Contains(content, *edit.OldValue) {
			return "", fmt.Errorf("oldValue not found in file")
		}
		return strings.Replace(content, *edit.OldValue, edit.NewValue, 1), nil
	}
	if edit.Line != nil && *edit.Line > 0 {
		lines := strings.Split(content, "\n")
		idx := *edit.Line - 1
		if idx < 0 || idx >= len(lines) {
			return "", fmt.Errorf("line %d out of range", *edit.Line)
		}
		line := lines[idx]
		col := 0
		if edit.Column != nil && *edit.Column > 0 {
			col = *edit.Column - 1
		}
		runes := []rune(line)
		if col > len(runes) {
			col = len(runes)
		}
		// Replace from column to end of a quoted/JSX text segment when possible;
		// otherwise insert newValue at column.
		newLine := string(runes[:col]) + edit.NewValue + string(runes[col:])
		if edit.OldValue != nil && *edit.OldValue != "" {
			newLine = strings.Replace(line, *edit.OldValue, edit.NewValue, 1)
		}
		lines[idx] = newLine
		return strings.Join(lines, "\n"), nil
	}
	if edit.NewValue == "" {
		return "", fmt.Errorf("newValue required")
	}
	// Fallback: append as a comment so the write is not a no-op without a target.
	return content + "\n{/* visual-edit: " + edit.NewValue + " */}\n", nil
}

func applyStyleEdit(content string, edit VisualEdit) (string, error) {
	prop := ""
	if edit.Property != nil {
		prop = strings.TrimSpace(*edit.Property)
	}
	if prop == "" {
		return "", fmt.Errorf("property required for style edit")
	}
	// Prefer replacing an existing CSS/JSX style assignment of this property.
	candidates := []string{
		prop + ":",
		prop + " :",
		`"` + prop + `":`,
		`'` + prop + `':`,
		prop + "=",
	}
	if edit.OldValue != nil && *edit.OldValue != "" {
		for _, prefix := range candidates {
			needle := prefix + " " + *edit.OldValue
			if strings.Contains(content, needle) {
				return strings.Replace(content, needle, prefix+" "+edit.NewValue, 1), nil
			}
			needle = prefix + *edit.OldValue
			if strings.Contains(content, needle) {
				return strings.Replace(content, needle, prefix+edit.NewValue, 1), nil
			}
		}
		if strings.Contains(content, *edit.OldValue) {
			return strings.Replace(content, *edit.OldValue, edit.NewValue, 1), nil
		}
	}
	// Append a style hint comment near the end for agents/UI to reconcile later.
	hint := fmt.Sprintf("\n{/* visual-style %s: %s */}\n", prop, edit.NewValue)
	return content + hint, nil
}
