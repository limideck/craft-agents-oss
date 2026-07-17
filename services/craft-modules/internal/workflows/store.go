package workflows

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	craftdb "github.com/craft-agent/craft-modules/internal/db"
	"github.com/google/uuid"
)

const triggersArmedNote = "Schedule/webhook runners are stub — triggers are recorded as armed but do not fire yet."

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func encodeDefinition(desc string, nodes []Node, edges []Edge) (string, error) {
	if nodes == nil {
		nodes = []Node{}
	}
	if edges == nil {
		edges = []Edge{}
	}
	for i := range nodes {
		if nodes[i].Config == nil {
			nodes[i].Config = map[string]any{}
		}
	}
	b, err := json.Marshal(definitionPayload{
		Description: desc,
		Nodes:       nodes,
		Edges:       edges,
	})
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func decodeDefinition(raw string) (definitionPayload, error) {
	var def definitionPayload
	if err := json.Unmarshal([]byte(raw), &def); err != nil {
		return def, err
	}
	if def.Nodes == nil {
		def.Nodes = []Node{}
	}
	if def.Edges == nil {
		def.Edges = []Edge{}
	}
	for i := range def.Nodes {
		if def.Nodes[i].Config == nil {
			def.Nodes[i].Config = map[string]any{}
		}
	}
	return def, nil
}

func encodeTriggersArmed(t *TriggersArmed) (sql.NullString, error) {
	if t == nil {
		return sql.NullString{}, nil
	}
	b, err := json.Marshal(t)
	if err != nil {
		return sql.NullString{}, err
	}
	return sql.NullString{String: string(b), Valid: true}, nil
}

func decodeTriggersArmed(raw sql.NullString) (*TriggersArmed, error) {
	if !raw.Valid || strings.TrimSpace(raw.String) == "" {
		return nil, nil
	}
	var t TriggersArmed
	if err := json.Unmarshal([]byte(raw.String), &t); err != nil {
		return nil, err
	}
	if t.Triggers == nil {
		t.Triggers = []ArmedTrigger{}
	}
	return &t, nil
}

// CollectTriggersArmed scans nodes for schedule/webhook triggers.
// Does not start runners — metadata only for deploy "armed" state.
func CollectTriggersArmed(nodes []Node) *TriggersArmed {
	out := &TriggersArmed{
		Armed:    false,
		Note:     triggersArmedNote,
		Triggers: []ArmedTrigger{},
	}
	for _, n := range nodes {
		switch n.Type {
		case "schedule":
			at := ArmedTrigger{NodeID: n.ID, Type: "schedule", Name: n.Name}
			if cron, ok := n.Config["cron"].(string); ok {
				at.Cron = cron
			}
			out.Triggers = append(out.Triggers, at)
			out.Armed = true
		case "webhook":
			at := ArmedTrigger{NodeID: n.ID, Type: "webhook", Name: n.Name}
			if path, ok := n.Config["path"].(string); ok {
				at.Path = path
			}
			if method, ok := n.Config["method"].(string); ok {
				at.Method = method
			}
			out.Triggers = append(out.Triggers, at)
			out.Armed = true
		}
	}
	return out
}

type workflowRow struct {
	id, name, defJSON, updatedAt string
	status                       string
	deployedDefJSON              sql.NullString
	deployedAt                   sql.NullString
	deployedVersion              int
	triggersArmedJSON            sql.NullString
}

func rowToWorkflow(r workflowRow) (Workflow, error) {
	def, err := decodeDefinition(r.defJSON)
	if err != nil {
		return Workflow{}, err
	}
	status := r.status
	if status == "" {
		status = StatusDraft
	}
	armed, err := decodeTriggersArmed(r.triggersArmedJSON)
	if err != nil {
		return Workflow{}, err
	}
	// Only surface triggersArmed when currently deployed.
	if status != StatusDeployed {
		armed = nil
	}
	wf := Workflow{
		ID:            r.id,
		Name:          r.name,
		Description:   def.Description,
		Nodes:         def.Nodes,
		Edges:         def.Edges,
		UpdatedAt:     r.updatedAt,
		Status:        status,
		Version:       r.deployedVersion,
		TriggersArmed: armed,
	}
	if r.deployedAt.Valid {
		wf.DeployedAt = r.deployedAt.String
	}
	return wf, nil
}

const selectWorkflowCols = `id, name, definition_json, updated_at, status,
  deployed_definition_json, deployed_at, deployed_version, triggers_armed_json`

func scanWorkflowRow(scanner interface {
	Scan(dest ...any) error
}) (workflowRow, error) {
	var r workflowRow
	err := scanner.Scan(
		&r.id, &r.name, &r.defJSON, &r.updatedAt, &r.status,
		&r.deployedDefJSON, &r.deployedAt, &r.deployedVersion, &r.triggersArmedJSON,
	)
	return r, err
}

func List(rdb *sql.DB) ([]Workflow, error) {
	var out []Workflow
	err := craftdb.WithBusyRetry(func() error {
		rows, err := rdb.Query(`SELECT ` + selectWorkflowCols + ` FROM workflows ORDER BY updated_at DESC`)
		if err != nil {
			return err
		}
		defer rows.Close()
		out = []Workflow{}
		for rows.Next() {
			r, err := scanWorkflowRow(rows)
			if err != nil {
				return err
			}
			wf, err := rowToWorkflow(r)
			if err != nil {
				return err
			}
			out = append(out, wf)
		}
		return rows.Err()
	})
	return out, err
}

func Get(rdb *sql.DB, id string) (Workflow, bool, error) {
	var wf Workflow
	var found bool
	err := craftdb.WithBusyRetry(func() error {
		row := rdb.QueryRow(`SELECT `+selectWorkflowCols+` FROM workflows WHERE id = ?`, id)
		r, err := scanWorkflowRow(row)
		if err == sql.ErrNoRows {
			found = false
			return nil
		}
		if err != nil {
			return err
		}
		wf, err = rowToWorkflow(r)
		if err != nil {
			return err
		}
		found = true
		return nil
	})
	return wf, found, err
}

type CreateInput struct {
	Name        string
	Description string
	Nodes       []Node
	Edges       []Edge
}

func Create(wdb *sql.DB, in CreateInput) (Workflow, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return Workflow{}, fmt.Errorf("name required")
	}
	id := uuid.New().String()
	updatedAt := nowISO()
	defJSON, err := encodeDefinition(in.Description, in.Nodes, in.Edges)
	if err != nil {
		return Workflow{}, err
	}
	err = craftdb.WithBusyRetry(func() error {
		_, err := wdb.Exec(
			`INSERT INTO workflows (id, name, definition_json, updated_at, status, deployed_version)
			 VALUES (?, ?, ?, ?, ?, 0)`,
			id, name, defJSON, updatedAt, StatusDraft,
		)
		return err
	})
	if err != nil {
		return Workflow{}, err
	}
	return rowToWorkflow(workflowRow{
		id: id, name: name, defJSON: defJSON, updatedAt: updatedAt,
		status: StatusDraft, deployedVersion: 0,
	})
}

type UpdateInput struct {
	Name        *string
	Description *string
	Nodes       *[]Node
	Edges       *[]Edge
}

func Update(wdb *sql.DB, id string, in UpdateInput) (Workflow, bool, error) {
	existing, ok, err := Get(wdb, id)
	if err != nil || !ok {
		return Workflow{}, ok, err
	}

	name := existing.Name
	desc := existing.Description
	nodes := existing.Nodes
	edges := existing.Edges

	if in.Name != nil {
		trimmed := strings.TrimSpace(*in.Name)
		if trimmed == "" {
			return Workflow{}, true, fmt.Errorf("name required")
		}
		name = trimmed
	}
	if in.Description != nil {
		desc = *in.Description
	}
	if in.Nodes != nil {
		nodes = *in.Nodes
	}
	if in.Edges != nil {
		edges = *in.Edges
	}

	updatedAt := nowISO()
	defJSON, err := encodeDefinition(desc, nodes, edges)
	if err != nil {
		return Workflow{}, true, err
	}
	err = craftdb.WithBusyRetry(func() error {
		res, err := wdb.Exec(
			`UPDATE workflows SET name = ?, definition_json = ?, updated_at = ? WHERE id = ?`,
			name, defJSON, updatedAt, id,
		)
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n == 0 {
			ok = false
		}
		return nil
	})
	if err != nil || !ok {
		return Workflow{}, ok, err
	}
	// Re-read so deploy metadata stays accurate.
	return Get(wdb, id)
}

func Delete(wdb *sql.DB, id string) (bool, error) {
	var found bool
	err := craftdb.WithBusyRetry(func() error {
		res, err := wdb.Exec(`DELETE FROM workflows WHERE id = ?`, id)
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		found = n > 0
		return nil
	})
	return found, err
}

// InsertRunStub inserts an accepted run row (no execution).
func InsertRunStub(wdb *sql.DB, workflowID string) (string, error) {
	runID := uuid.New().String()
	createdAt := nowISO()
	err := craftdb.WithBusyRetry(func() error {
		_, err := wdb.Exec(
			`INSERT INTO runs (id, workflow_id, status, created_at) VALUES (?, ?, ?, ?)`,
			runID, workflowID, "accepted", createdAt,
		)
		return err
	})
	return runID, err
}

// Deploy snapshots the current draft definition as the live version.
// Schedule/webhook nodes are recorded in triggersArmed metadata; runners remain stub.
func Deploy(wdb *sql.DB, id string) (DeployResult, bool, error) {
	var result DeployResult
	var found bool
	err := craftdb.WithBusyRetry(func() error {
		var defJSON string
		var version int
		err := wdb.QueryRow(
			`SELECT definition_json, deployed_version FROM workflows WHERE id = ?`, id,
		).Scan(&defJSON, &version)
		if err == sql.ErrNoRows {
			found = false
			return nil
		}
		if err != nil {
			return err
		}
		found = true

		def, err := decodeDefinition(defJSON)
		if err != nil {
			return err
		}
		armed := CollectTriggersArmed(def.Nodes)
		armedJSON, err := encodeTriggersArmed(armed)
		if err != nil {
			return err
		}

		version++
		deployedAt := nowISO()
		_, err = wdb.Exec(`
UPDATE workflows SET
  status = ?,
  deployed_definition_json = definition_json,
  deployed_at = ?,
  deployed_version = ?,
  triggers_armed_json = ?,
  updated_at = ?
WHERE id = ?`,
			StatusDeployed, deployedAt, version, armedJSON, deployedAt, id,
		)
		if err != nil {
			return err
		}
		result = DeployResult{
			ID:            id,
			Version:       version,
			DeployedAt:    deployedAt,
			Status:        StatusDeployed,
			TriggersArmed: armed,
		}
		return nil
	})
	return result, found, err
}

// Undeploy clears live status (keeps last version / deployedAt for history).
func Undeploy(wdb *sql.DB, id string) (DeployResult, bool, error) {
	var result DeployResult
	var found bool
	err := craftdb.WithBusyRetry(func() error {
		var version int
		var deployedAt sql.NullString
		err := wdb.QueryRow(
			`SELECT deployed_version, deployed_at FROM workflows WHERE id = ?`, id,
		).Scan(&version, &deployedAt)
		if err == sql.ErrNoRows {
			found = false
			return nil
		}
		if err != nil {
			return err
		}
		found = true

		updatedAt := nowISO()
		_, err = wdb.Exec(`
UPDATE workflows SET
  status = ?,
  deployed_definition_json = NULL,
  triggers_armed_json = NULL,
  updated_at = ?
WHERE id = ?`,
			StatusDraft, updatedAt, id,
		)
		if err != nil {
			return err
		}
		result = DeployResult{
			ID:      id,
			Version: version,
			Status:  StatusDraft,
		}
		if deployedAt.Valid {
			result.DeployedAt = deployedAt.String
		}
		return nil
	})
	return result, found, err
}
