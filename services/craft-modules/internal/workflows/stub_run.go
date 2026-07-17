package workflows

import (
	"fmt"
	"time"
)

// RunStep is a stub-synthesized per-node step (no real executor).
type RunStep struct {
	ID         string `json:"id"`
	NodeID     string `json:"nodeId"`
	Name       string `json:"name"`
	NodeType   string `json:"nodeType"`
	Status     string `json:"status"`
	DurationMs int    `json:"durationMs"`
	Input      any    `json:"input"`
	Output     any    `json:"output"`
	Error      string `json:"error,omitempty"`
}

var triggerTypes = map[string]bool{
	"start":    true,
	"schedule": true,
	"webhook":  true,
}

func sampleDuration(nodeType string, index int) int {
	base := map[string]int{
		"start": 12, "schedule": 8, "webhook": 18,
		"agent": 420, "generate-image": 900,
		"parameter-extractor": 280, "question-classifier": 260,
		"condition": 6, "switch": 8, "filter": 7, "merge": 10, "loop": 40,
		"human-approval": 50,
		"variables": 4, "set-fields": 5, "template": 12, "json": 9,
		"transform": 22, "function": 45,
		"http": 180, "wait": 25, "response": 9, "subworkflow": 60,
	}
	b, ok := base[nodeType]
	if !ok {
		b = 30
	}
	return b + (index%5)*3
}

func sampleInput(n Node, prev map[string]any) map[string]any {
	incoming := prev
	if incoming == nil {
		incoming = map[string]any{"trigger": "manual"}
	}
	cfg := n.Config
	if cfg == nil {
		cfg = map[string]any{}
	}
	switch n.Type {
	case "start":
		out := map[string]any{"trigger": "manual"}
		if s, ok := cfg["inputSchema"]; ok {
			out["schema"] = s
		}
		return out
	case "schedule":
		cron, _ := cfg["cron"].(string)
		if cron == "" {
			cron = "0 9 * * *"
		}
		tz, _ := cfg["timezone"].(string)
		if tz == "" {
			tz = "UTC"
		}
		return map[string]any{"cron": cron, "timezone": tz}
	case "webhook":
		path, _ := cfg["path"].(string)
		if path == "" {
			path = "/hooks"
		}
		method, _ := cfg["method"].(string)
		if method == "" {
			method = "POST"
		}
		return map[string]any{"path": path, "method": method, "body": incoming}
	case "agent":
		agent, _ := cfg["agent"].(string)
		if agent == "" {
			agent = "default"
		}
		model, _ := cfg["model"].(string)
		if model == "" {
			model = "default"
		}
		return map[string]any{
			"agent": agent, "model": model, "prompt": cfg["prompt"], "context": incoming,
		}
	case "generate-image":
		prompt, _ := cfg["prompt"].(string)
		model, _ := cfg["model"].(string)
		if model == "" {
			model = "default"
		}
		size, _ := cfg["size"].(string)
		if size == "" {
			size = "1024x1024"
		}
		return map[string]any{"prompt": prompt, "model": model, "size": size}
	case "parameter-extractor":
		source, _ := cfg["source"].(string)
		if source == "" {
			source = "payload"
		}
		schema := cfg["schema"]
		if schema == nil {
			schema = []any{}
		}
		return map[string]any{
			"source": source, "instruction": cfg["instruction"], "schema": schema, "input": incoming,
		}
	case "question-classifier":
		source, _ := cfg["source"].(string)
		if source == "" {
			source = "payload"
		}
		cats := cfg["categories"]
		if cats == nil {
			cats = []any{}
		}
		return map[string]any{"source": source, "categories": cats, "input": incoming}
	case "http":
		url, _ := cfg["url"].(string)
		if url == "" {
			url = "https://example.com"
		}
		method, _ := cfg["method"].(string)
		if method == "" {
			method = "GET"
		}
		headers := cfg["headers"]
		if headers == nil {
			headers = map[string]any{}
		}
		body := cfg["body"]
		if body == nil {
			body = incoming
		}
		return map[string]any{"url": url, "method": method, "headers": headers, "body": body}
	case "function":
		code, _ := cfg["code"].(string)
		if len(code) > 120 {
			code = code[:120]
		}
		return map[string]any{"code": code, "input": incoming}
	case "condition":
		expr, _ := cfg["expression"].(string)
		if expr == "" {
			expr = "true"
		}
		return map[string]any{"expression": expr, "input": incoming}
	case "switch":
		expr, _ := cfg["expression"].(string)
		cases := cfg["cases"]
		if cases == nil {
			cases = []any{}
		}
		return map[string]any{"expression": expr, "cases": cases, "input": incoming}
	case "filter":
		expr, _ := cfg["expression"].(string)
		if expr == "" {
			expr = "true"
		}
		return map[string]any{"expression": expr, "input": incoming}
	case "merge":
		mode, _ := cfg["mode"].(string)
		if mode == "" {
			mode = "wait-all"
		}
		return map[string]any{"mode": mode, "input": incoming}
	case "loop":
		mode, _ := cfg["mode"].(string)
		if mode == "" {
			mode = "foreach"
		}
		items, _ := cfg["items"].(string)
		if items == "" {
			items = "payload.items"
		}
		maxIter := cfg["maxIterations"]
		if maxIter == nil {
			maxIter = 100
		}
		return map[string]any{"mode": mode, "items": items, "maxIterations": maxIter, "input": incoming}
	case "human-approval":
		title, _ := cfg["title"].(string)
		if title == "" {
			title = "Approval required"
		}
		return map[string]any{"title": title, "instruction": cfg["instruction"], "input": incoming}
	case "variables":
		asg := cfg["assignments"]
		if asg == nil {
			asg = []any{}
		}
		return map[string]any{"assignments": asg, "input": incoming}
	case "set-fields":
		fields := cfg["fields"]
		if fields == nil {
			fields = []any{}
		}
		keep := cfg["keepIncoming"]
		if keep == nil {
			keep = true
		}
		return map[string]any{"fields": fields, "keepIncoming": keep, "input": incoming}
	case "template":
		tmpl, _ := cfg["template"].(string)
		mode, _ := cfg["outputMode"].(string)
		if mode == "" {
			mode = "text"
		}
		return map[string]any{"template": tmpl, "outputMode": mode, "input": incoming}
	case "json":
		mode, _ := cfg["mode"].(string)
		if mode == "" {
			mode = "parse"
		}
		path, _ := cfg["path"].(string)
		if path == "" {
			path = "payload"
		}
		return map[string]any{"mode": mode, "path": path, "input": incoming}
	case "wait":
		dur := cfg["duration"]
		if dur == nil {
			dur = 1
		}
		unit, _ := cfg["unit"].(string)
		if unit == "" {
			unit = "seconds"
		}
		return map[string]any{"duration": dur, "unit": unit}
	case "response":
		status := cfg["status"]
		if status == nil {
			status = 200
		}
		body := cfg["body"]
		if body == nil {
			body = incoming
		}
		return map[string]any{"status": status, "body": body}
	case "transform":
		mapping := cfg["mapping"]
		if mapping == nil {
			mapping = map[string]any{}
		}
		return map[string]any{"mapping": mapping, "input": incoming}
	case "subworkflow":
		wfID, _ := cfg["workflowId"].(string)
		in := cfg["input"]
		if in == nil {
			in = incoming
		}
		return map[string]any{"workflowId": wfID, "input": in}
	default:
		return map[string]any{"config": cfg, "input": incoming}
	}
}

func sampleOutput(n Node, input map[string]any) map[string]any {
	cfg := n.Config
	if cfg == nil {
		cfg = map[string]any{}
	}
	switch n.Type {
	case "start":
		return map[string]any{"started": true, "at": time.Now().UTC().Format(time.RFC3339Nano), "payload": map[string]any{}}
	case "schedule":
		return map[string]any{"fired": true, "cron": input["cron"]}
	case "webhook":
		return map[string]any{"received": true, "path": input["path"], "status": 200}
	case "agent":
		agent, _ := input["agent"].(string)
		// Direct Go/MCP path only — Craft `workflows:run` replaces this with a real session reply.
		return map[string]any{
			"text":      fmt.Sprintf("(Go stub) agent %q — execute via Craft workflows:run for a real model reply", agent),
			"model":     input["model"],
			"delegated": true,
		}
	case "generate-image":
		return map[string]any{
			"url":   "https://example.com/stub-image.png",
			"size":  input["size"],
			"model": input["model"],
		}
	case "parameter-extractor":
		schema := input["schema"]
		if schema == nil {
			schema = []any{}
		}
		return map[string]any{"extracted": map[string]any{}, "fields": schema}
	case "question-classifier":
		return map[string]any{"category": "other", "confidence": 0.72}
	case "http":
		return map[string]any{
			"status":  200,
			"headers": map[string]any{"content-type": "application/json"},
			"body":    map[string]any{"ok": true, "echo": input["body"]},
		}
	case "function":
		return map[string]any{"result": nil, "logs": []any{"(stub) function executed"}}
	case "condition":
		return map[string]any{"result": true, "branch": "true"}
	case "switch":
		return map[string]any{"branch": "case0", "matched": true}
	case "filter":
		return map[string]any{"branch": "pass", "matched": true}
	case "merge":
		return map[string]any{"merged": true, "mode": input["mode"]}
	case "loop":
		return map[string]any{"iterations": 1, "done": true}
	case "human-approval":
		return map[string]any{"decision": "approved", "title": input["title"]}
	case "variables":
		asg := input["assignments"]
		if asg == nil {
			asg = []any{}
		}
		return map[string]any{"set": asg, "vars": map[string]any{}}
	case "set-fields":
		fields := input["fields"]
		if fields == nil {
			fields = []any{}
		}
		return map[string]any{"fields": fields, "payload": map[string]any{}}
	case "template":
		tmpl, _ := input["template"].(string)
		return map[string]any{"rendered": tmpl, "mode": input["outputMode"]}
	case "json":
		mode, _ := input["mode"].(string)
		val := any(map[string]any{})
		if mode == "stringify" {
			val = "{}"
		}
		return map[string]any{"mode": mode, "value": val}
	case "wait":
		return map[string]any{"waitedMs": 1000, "unit": input["unit"]}
	case "response":
		headers := cfg["headers"]
		if headers == nil {
			headers = map[string]any{}
		}
		body := input["body"]
		if body == nil {
			body = map[string]any{"ok": true}
		}
		status := input["status"]
		if status == nil {
			status = 200
		}
		return map[string]any{"status": status, "body": body, "headers": headers}
	case "transform":
		mapping := input["mapping"]
		if mapping == nil {
			mapping = map[string]any{}
		}
		return map[string]any{"data": mapping, "mapped": true}
	case "subworkflow":
		return map[string]any{"workflowId": input["workflowId"], "accepted": true, "runId": "stub-sub-run"}
	default:
		return map[string]any{"ok": true, "type": n.Type}
	}
}

func linearizeNodes(nodes []Node, edges []Edge) []Node {
	if len(nodes) == 0 {
		return nil
	}
	byID := make(map[string]Node, len(nodes))
	outgoing := make(map[string][]string, len(nodes))
	indegree := make(map[string]int, len(nodes))
	for _, n := range nodes {
		byID[n.ID] = n
		outgoing[n.ID] = nil
		indegree[n.ID] = 0
	}
	for _, e := range edges {
		if _, ok := byID[e.Source]; !ok {
			continue
		}
		if _, ok := byID[e.Target]; !ok {
			continue
		}
		outgoing[e.Source] = append(outgoing[e.Source], e.Target)
		indegree[e.Target]++
	}

	var queue []Node
	for _, n := range nodes {
		if triggerTypes[n.Type] || indegree[n.ID] == 0 {
			queue = append(queue, n)
		}
	}
	if len(queue) == 0 {
		queue = append(queue, nodes...)
	}

	seen := make(map[string]bool)
	var ordered []Node
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		if seen[cur.ID] {
			continue
		}
		seen[cur.ID] = true
		ordered = append(ordered, cur)
		for _, nextID := range outgoing[cur.ID] {
			if !seen[nextID] {
				if next, ok := byID[nextID]; ok {
					queue = append(queue, next)
				}
			}
		}
	}
	for _, n := range nodes {
		if !seen[n.ID] {
			ordered = append(ordered, n)
		}
	}
	return ordered
}

// SynthesizeRunSteps builds demonstrable per-node Input/Output from the graph.
// Stub only — not a real executor.
func SynthesizeRunSteps(wf Workflow, runID string) []RunStep {
	ordered := linearizeNodes(wf.Nodes, wf.Edges)
	steps := make([]RunStep, 0, len(ordered))
	var prev map[string]any
	for i, n := range ordered {
		input := sampleInput(n, prev)
		output := sampleOutput(n, input)
		steps = append(steps, RunStep{
			ID:         fmt.Sprintf("step-%s-%d", runID, i+1),
			NodeID:     n.ID,
			Name:       n.Name,
			NodeType:   n.Type,
			Status:     "success",
			DurationMs: sampleDuration(n.Type, i),
			Input:      input,
			Output:     output,
		})
		prev = output
	}
	return steps
}
