import { useCallback, useEffect, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { toast } from 'sonner'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { WorkflowCanvasNode, type WorkflowCanvasNodeData } from '../components/workflow-node'
import type { WorkflowEdge, WorkflowNode, WorkflowNodeType } from '../mock/types'
import {
  WORKFLOW_BLOCK_DND_MIME,
  addNode,
  connectNodes,
  deleteEdge,
  deleteNode,
  selectedEdgeIdAtom,
  selectedNodeIdAtom,
  selectedWorkflowIdAtom,
  updateNodePosition,
  workflowErrorAtom,
  workflowLoadingAtom,
  workflowNodeRunStatusAtom,
  workflowRightTabAtom,
  workflowsAtom,
} from '../store'
import { scheduleWorkflowPersist } from '../use-workflow-data'
import { getWorkflowById } from '../utils/lookup'

const nodeTypes: NodeTypes = {
  workflow: WorkflowCanvasNode,
}

function toRfNodes(
  workflowNodes: WorkflowNode[],
  selectedNodeId: string | null,
  runStatus: Record<string, string>,
): Node<WorkflowCanvasNodeData>[] {
  return workflowNodes.map((n) => ({
    id: n.id,
    type: 'workflow',
    position: n.position,
    selected: selectedNodeId === n.id,
    data: {
      type: n.type,
      name: n.name,
      runStatus: (runStatus[n.id] as WorkflowCanvasNodeData['runStatus']) ?? 'idle',
    },
  }))
}

function toRfEdges(edges: WorkflowEdge[], selectedEdgeId: string | null): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    selected: selectedEdgeId === e.id,
  }))
}

function CanvasInner() {
  const [workflows, setWorkflows] = useAtom(workflowsAtom)
  const selectedWorkflowId = useAtomValue(selectedWorkflowIdAtom)
  const [selectedNodeId, setSelectedNodeId] = useAtom(selectedNodeIdAtom)
  const [selectedEdgeId, setSelectedEdgeId] = useAtom(selectedEdgeIdAtom)
  const setRightTab = useSetAtom(workflowRightTabAtom)
  const runStatus = useAtomValue(workflowNodeRunStatusAtom)
  const { screenToFlowPosition } = useReactFlow()

  const workflow = getWorkflowById(workflows, selectedWorkflowId)
  const workflowIdRef = useRef(selectedWorkflowId)
  workflowIdRef.current = selectedWorkflowId

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<Node<WorkflowCanvasNodeData>>([])
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<Edge>([])

  useEffect(() => {
    const wf = getWorkflowById(workflows, selectedWorkflowId)
    setNodes(toRfNodes(wf?.nodes ?? [], selectedNodeId, runStatus))
    setEdges(toRfEdges(wf?.edges ?? [], selectedEdgeId))
  }, [
    workflows,
    selectedWorkflowId,
    selectedNodeId,
    selectedEdgeId,
    runStatus,
    setNodes,
    setEdges,
  ])

  const onNodesChange: OnNodesChange<Node<WorkflowCanvasNodeData>> = useCallback(
    (changes) => {
      onNodesChangeInternal(changes)
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging === false) {
          const wfId = workflowIdRef.current
          if (!wfId) continue
          setWorkflows((prev) => updateNodePosition(prev, wfId, change.id, change.position!))
          scheduleWorkflowPersist(wfId)
        }
      }
    },
    [onNodesChangeInternal, setWorkflows],
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChangeInternal(changes)
    },
    [onEdgesChangeInternal],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const wfId = workflowIdRef.current
      if (!wfId || !connection.source || !connection.target) return

      setWorkflows((prev) => {
        const result = connectNodes(prev, wfId, connection)
        if (!result.ok) {
          toast.message(result.reason ?? 'Cannot connect')
          return prev
        }
        scheduleWorkflowPersist(wfId)
        return result.workflows
      })
    },
    [setWorkflows],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      setSelectedEdgeId(null)
      setRightTab('editor')
    },
    [setSelectedNodeId, setSelectedEdgeId, setRightTab],
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id)
      setSelectedNodeId(null)
    },
    [setSelectedEdgeId, setSelectedNodeId],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [setSelectedNodeId, setSelectedEdgeId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      const wfId = workflowIdRef.current
      if (!wfId) return

      if (selectedNodeId) {
        e.preventDefault()
        setWorkflows((prev) => deleteNode(prev, wfId, selectedNodeId))
        scheduleWorkflowPersist(wfId)
        setSelectedNodeId(null)
      } else if (selectedEdgeId) {
        e.preventDefault()
        setWorkflows((prev) => deleteEdge(prev, wfId, selectedEdgeId))
        scheduleWorkflowPersist(wfId)
        setSelectedEdgeId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedNodeId, selectedEdgeId, setWorkflows, setSelectedNodeId, setSelectedEdgeId])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData(WORKFLOW_BLOCK_DND_MIME)
      if (!raw) return
      let type: WorkflowNodeType
      try {
        const parsed = JSON.parse(raw) as { type: WorkflowNodeType }
        type = parsed.type
      } catch {
        return
      }
      const wfId = workflowIdRef.current
      if (!wfId) {
        toast.message('Select a workflow first')
        return
      }
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setWorkflows((prev) => {
        const { workflows: next, nodeId } = addNode(prev, wfId, type, position)
        setSelectedNodeId(nodeId)
        setSelectedEdgeId(null)
        setRightTab('editor')
        scheduleWorkflowPersist(wfId)
        return next
      })
    },
    [setWorkflows, setSelectedNodeId, setSelectedEdgeId, setRightTab, screenToFlowPosition],
  )

  if (!workflow) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center p-4 text-sm text-muted-foreground">
        Select a workflow from the list.
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      deleteKeyCode={null}
      className="bg-muted/20"
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls showInteractive={false} className="!shadow-sm" />
      <MiniMap
        className="!bg-card !border-border"
        maskColor="color-mix(in srgb, var(--muted) 60%, transparent)"
        pannable
        zoomable
      />
    </ReactFlow>
  )
}

/**
 * Center-top canvas — @xyflow/react graph with pan/zoom, connect, drag-add.
 */
export function CanvasPanel() {
  const workflows = useAtomValue(workflowsAtom)
  const selectedWorkflowId = useAtomValue(selectedWorkflowIdAtom)
  const loading = useAtomValue(workflowLoadingAtom)
  const error = useAtomValue(workflowErrorAtom)
  const workflow = getWorkflowById(workflows, selectedWorkflowId)
  const nodeCount = workflow?.nodes.length ?? 0
  const edgeCount = workflow?.edges.length ?? 0

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium truncate min-w-0">
            {workflow ? workflow.name : 'Canvas'}
          </span>
          {workflow?.status === 'deployed' && workflow.version > 0 ? (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-foreground-10 text-muted-foreground"
              title={workflow.deployedAt ? `Deployed ${workflow.deployedAt}` : undefined}
            >
              Deployed · v{workflow.version}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
          {loading && !workflow ? 'Loading…' : `${nodeCount} nodes · ${edgeCount} edges`}
        </span>
      </PanelHeaderBar>
      <PanelBody padding={false} scroll={false} className="relative p-0 overflow-hidden">
        {error && !workflow ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            {error}
          </div>
        ) : (
          <ReactFlowProvider key={selectedWorkflowId ?? 'none'}>
            <div className="h-full w-full" role="application" aria-label="Workflow canvas">
              <CanvasInner />
            </div>
          </ReactFlowProvider>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
