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

func rowToWorkflow(id, name, defJSON, updatedAt string) (Workflow, error) {
	def, err := decodeDefinition(defJSON)
	if err != nil {
		return Workflow{}, err
	}
	return Workflow{
		ID:          id,
		Name:        name,
		Description: def.Description,
		Nodes:       def.Nodes,
		Edges:       def.Edges,
		UpdatedAt:   updatedAt,
	}, nil
}

func List(rdb *sql.DB) ([]Workflow, error) {
	var out []Workflow
	err := craftdb.WithBusyRetry(func() error {
		rows, err := rdb.Query(`SELECT id, name, definition_json, updated_at FROM workflows ORDER BY updated_at DESC`)
		if err != nil {
			return err
		}
		defer rows.Close()
		out = []Workflow{}
		for rows.Next() {
			var id, name, defJSON, updatedAt string
			if err := rows.Scan(&id, &name, &defJSON, &updatedAt); err != nil {
				return err
			}
			wf, err := rowToWorkflow(id, name, defJSON, updatedAt)
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
		var name, defJSON, updatedAt string
		err := rdb.QueryRow(
			`SELECT name, definition_json, updated_at FROM workflows WHERE id = ?`, id,
		).Scan(&name, &defJSON, &updatedAt)
		if err == sql.ErrNoRows {
			found = false
			return nil
		}
		if err != nil {
			return err
		}
		wf, err = rowToWorkflow(id, name, defJSON, updatedAt)
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
			`INSERT INTO workflows (id, name, definition_json, updated_at) VALUES (?, ?, ?, ?)`,
			id, name, defJSON, updatedAt,
		)
		return err
	})
	if err != nil {
		return Workflow{}, err
	}
	return rowToWorkflow(id, name, defJSON, updatedAt)
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
	wf, err := rowToWorkflow(id, name, defJSON, updatedAt)
	return wf, true, err
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
