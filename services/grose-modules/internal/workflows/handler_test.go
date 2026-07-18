package workflows_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grose-agent/grose-modules/internal/workflows"
	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"
)

func TestHTTPDeployRoundTrip(t *testing.T) {
	dir := t.TempDir()
	mgr := workflows.NewManager()
	h := &workflows.Handler{Mgr: mgr}

	r := chi.NewRouter()
	r.Route("/api/workflows", h.Mount)

	createBody := `{"name":"Deploy me","nodes":[{"id":"n1","type":"schedule","name":"Daily","position":{"x":0,"y":0},"config":{"cron":"0 9 * * *"}},{"id":"n2","type":"agent","name":"A","position":{"x":1,"y":0},"config":{"agent":"default"}}],"edges":[{"id":"e1","source":"n1","target":"n2"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/workflows", strings.NewReader(createBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Grose-Workspace-Id", "ws-http")
	req.Header.Set("X-Grose-Workspace-Root", dir)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", rr.Code, rr.Body.String())
	}
	var created workflows.Workflow
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/workflows/"+created.ID+"/deploy", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Grose-Workspace-Id", "ws-http")
	req.Header.Set("X-Grose-Workspace-Root", dir)
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("deploy status=%d body=%s", rr.Code, rr.Body.String())
	}
	var dep workflows.DeployResult
	if err := json.Unmarshal(rr.Body.Bytes(), &dep); err != nil {
		t.Fatal(err)
	}
	if dep.Status != workflows.StatusDeployed || dep.Version != 1 || dep.DeployedAt == "" {
		t.Fatalf("deploy=%+v", dep)
	}
	if dep.TriggersArmed == nil || !dep.TriggersArmed.Armed {
		t.Fatalf("expected armed triggers: %+v", dep.TriggersArmed)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/workflows/"+created.ID, nil)
	req.Header.Set("X-Grose-Workspace-Id", "ws-http")
	req.Header.Set("X-Grose-Workspace-Root", dir)
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("get status=%d body=%s", rr.Code, rr.Body.String())
	}
	var got workflows.Workflow
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Status != workflows.StatusDeployed || got.Version != 1 || got.DeployedAt == "" {
		t.Fatalf("get after deploy=%+v", got)
	}
}
