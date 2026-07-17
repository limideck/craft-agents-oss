package workflows

import (
	"encoding/json"
	"net/http"
	"strings"

	craftdb "github.com/craft-agent/craft-modules/internal/db"
	"github.com/craft-agent/craft-modules/internal/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves /api/workflows CRUD (+ run stub).
type Handler struct {
	Mgr *Manager
}

func (h *Handler) Mount(r chi.Router) {
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/{id}", h.get)
	r.Patch("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	r.Post("/{id}/run", h.run)
}

func (h *Handler) open(r *http.Request) (*craftdb.DB, error) {
	ws := strings.TrimSpace(r.Header.Get("X-Craft-Workspace-Id"))
	return h.Mgr.Get(ws)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	handle, err := h.open(r)
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
	handle, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	wf, ok, err := Get(handle.Reader(), chi.URLParam(r, "id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, wf)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Nodes       []Node `json:"nodes"`
		Edges       []Edge `json:"edges"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON body"})
		return
	}
	handle, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	wf, err := Create(handle.Writer(), CreateInput{
		Name:        body.Name,
		Description: body.Description,
		Nodes:       body.Nodes,
		Edges:       body.Edges,
	})
	if err != nil {
		if err.Error() == "name required" {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "name required"})
			return
		}
		serverError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, wf)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Nodes       *[]Node `json:"nodes"`
		Edges       *[]Edge `json:"edges"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON body"})
		return
	}
	handle, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	wf, ok, err := Update(handle.Writer(), chi.URLParam(r, "id"), UpdateInput{
		Name:        body.Name,
		Description: body.Description,
		Nodes:       body.Nodes,
		Edges:       body.Edges,
	})
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
	httpx.WriteJSON(w, http.StatusOK, wf)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	handle, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	ok, err := Delete(handle.Writer(), chi.URLParam(r, "id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) run(w http.ResponseWriter, r *http.Request) {
	handle, err := h.open(r)
	if err != nil {
		serverError(w, err)
		return
	}
	id := chi.URLParam(r, "id")
	wf, ok, err := Get(handle.Reader(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	runID, err := InsertRunStub(handle.Writer(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	// Stub only — synthesize per-node steps from graph (no real execution).
	steps := SynthesizeRunSteps(wf, runID)
	httpx.WriteJSON(w, http.StatusAccepted, map[string]any{
		"accepted": true,
		"runId":    runID,
		"steps":    steps,
	})
}

func serverError(w http.ResponseWriter, err error) {
	httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
}
