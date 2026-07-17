package sites

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	craftdb "github.com/craft-agent/craft-modules/internal/db"
	"github.com/craft-agent/craft-modules/internal/httpx"
	"github.com/craft-agent/craft-modules/internal/workspace"
	"github.com/go-chi/chi/v5"
)

// Handler serves /api/sites.
type Handler struct {
	Mgr     *Manager
	Preview *PreviewManager
}

func (h *Handler) Mount(r chi.Router) {
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/{id}", h.get)
	r.Patch("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	r.Get("/{id}/files", h.listFiles)
	r.Get("/{id}/files/content", h.readFile)
	r.Put("/{id}/files/content", h.writeFile)
	r.Post("/{id}/preview/start", h.previewStart)
	r.Post("/{id}/preview/stop", h.previewStop)
	r.Get("/{id}/preview", h.previewGet)
	r.Post("/{id}/visual-edit", h.visualEdit)
	r.Post("/{id}/run", h.runCommand)
}

func (h *Handler) open(r *http.Request) (*craftdb.DB, string, error) {
	ws := strings.TrimSpace(r.Header.Get("X-Craft-Workspace-Id"))
	headerRoot := strings.TrimSpace(r.Header.Get(workspace.HeaderRoot))
	root, err := workspace.ResolveRoot(ws, headerRoot)
	if err != nil {
		return nil, "", err
	}
	handle, err := h.Mgr.Get(ws, root)
	if err != nil {
		return nil, "", err
	}
	return handle, root, nil
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	handle, _, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	items, err := List(handle.Reader())
	if err != nil {
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	handle, _, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	site, ok, err := Get(handle.Reader(), chi.URLParam(r, "id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, site)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var body CreateInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON body"})
		return
	}
	handle, root, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	site, err := Create(handle.Writer(), root, body)
	if err != nil {
		if err.Error() == "name required" {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "name required"})
			return
		}
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, site)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON body"})
		return
	}
	in := storeUpdate{}
	if v, ok := raw["name"]; ok {
		var name string
		if err := json.Unmarshal(v, &name); err != nil {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid name"})
			return
		}
		in.Name = &name
	}
	if v, ok := raw["sessionId"]; ok {
		if string(v) == "null" {
			in.ClearSession = true
		} else {
			var sid string
			if err := json.Unmarshal(v, &sid); err != nil {
				httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid sessionId"})
				return
			}
			in.SessionID = &sid
		}
	}
	handle, _, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	site, ok, err := Update(handle.Writer(), chi.URLParam(r, "id"), in)
	if err != nil {
		if err.Error() == "name required" {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "name required"})
			return
		}
		serverError(w, err)
		return
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, site)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	handle, _, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	id := chi.URLParam(r, "id")
	site, ok, err := Delete(handle.Writer(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	_ = h.Preview.Stop(id)
	_ = os.RemoveAll(site.Path)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) requireSite(w http.ResponseWriter, r *http.Request) (*craftdb.DB, Site, bool) {
	handle, _, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return nil, Site{}, false
	}
	site, ok, err := Get(handle.Reader(), chi.URLParam(r, "id"))
	if err != nil {
		serverError(w, err)
		return nil, Site{}, false
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return nil, Site{}, false
	}
	return handle, site, true
}

func (h *Handler) listFiles(w http.ResponseWriter, r *http.Request) {
	_, site, ok := h.requireSite(w, r)
	if !ok {
		return
	}
	tree, err := ListFiles(site.Path)
	if err != nil {
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, tree)
}

func (h *Handler) readFile(w http.ResponseWriter, r *http.Request) {
	_, site, ok := h.requireSite(w, r)
	if !ok {
		return
	}
	path := r.URL.Query().Get("path")
	rel, content, err := ReadFile(site.Path, path)
	if err != nil {
		if os.IsNotExist(err) {
			httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "file not found"})
			return
		}
		if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "escapes") || strings.Contains(err.Error(), "required") {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"path": rel, "content": content})
}

func (h *Handler) writeFile(w http.ResponseWriter, r *http.Request) {
	_, site, ok := h.requireSite(w, r)
	if !ok {
		return
	}
	var body struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON body"})
		return
	}
	if err := WriteFile(site.Path, body.Path, body.Content); err != nil {
		if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "escapes") || strings.Contains(err.Error(), "required") {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) previewStart(w http.ResponseWriter, r *http.Request) {
	handle, site, ok := h.requireSite(w, r)
	if !ok {
		return
	}
	status := StatusInstalling
	_, _, _ = Update(handle.Writer(), site.ID, storeUpdate{Status: &status})

	port, url, err := h.Preview.Start(r.Context(), site.ID, site.Path)
	if err != nil {
		errStatus := StatusError
		_, _, _ = Update(handle.Writer(), site.ID, storeUpdate{Status: &errStatus})
		httpx.WriteJSON(w, http.StatusBadGateway, map[string]any{"error": "preview start failed", "detail": err.Error()})
		return
	}
	updated, _, err := SetPreview(handle.Writer(), site.ID, port, url, StatusPreviewing)
	if err != nil {
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, PreviewResult{
		PreviewURL:  updated.PreviewURL,
		PreviewPort: updated.PreviewPort,
		Status:      updated.Status,
	})
}

func (h *Handler) previewStop(w http.ResponseWriter, r *http.Request) {
	handle, site, ok := h.requireSite(w, r)
	if !ok {
		return
	}
	_ = h.Preview.Stop(site.ID)
	_, _, err := ClearPreview(handle.Writer(), site.ID, StatusReady)
	if err != nil {
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) previewGet(w http.ResponseWriter, r *http.Request) {
	handle, site, ok := h.requireSite(w, r)
	if !ok {
		return
	}
	port, url, running := h.Preview.Status(site.ID)
	if running {
		// Keep DB in sync if process is live.
		if site.PreviewPort == nil || *site.PreviewPort != port || site.Status != StatusPreviewing {
			updated, _, err := SetPreview(handle.Writer(), site.ID, port, url, StatusPreviewing)
			if err == nil {
				site = updated
			}
		}
		httpx.WriteJSON(w, http.StatusOK, PreviewResult{
			PreviewURL:  site.PreviewURL,
			PreviewPort: site.PreviewPort,
			Status:      site.Status,
		})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, PreviewResult{
		PreviewURL:  site.PreviewURL,
		PreviewPort: site.PreviewPort,
		Status:      site.Status,
	})
}

func (h *Handler) visualEdit(w http.ResponseWriter, r *http.Request) {
	_, site, ok := h.requireSite(w, r)
	if !ok {
		return
	}
	var body VisualEditSaveInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON body"})
		return
	}
	if body.FilePath == "" {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "filePath required"})
		return
	}
	if err := ApplyVisualEdits(site.Path, body.FilePath, body.Edits); err != nil {
		if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "escapes") ||
			strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "not found") ||
			strings.Contains(err.Error(), "out of range") || strings.Contains(err.Error(), "unsupported") {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) runCommand(w http.ResponseWriter, r *http.Request) {
	_, site, ok := h.requireSite(w, r)
	if !ok {
		return
	}
	var body RunCommandInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON body"})
		return
	}
	res, err := RunCommand(r.Context(), site.Path, body)
	if err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func serverError(w http.ResponseWriter, err error) {
	httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
}
