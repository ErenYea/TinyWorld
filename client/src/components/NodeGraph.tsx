import { useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import { ErrorBoundary } from './ErrorBoundary';
import 'reactflow/dist/style.css';

interface Agent {
  id: string;
  name: string;
  status: string;
  currentTask?: string;
  connections: string[];
}

interface NodeGraphProps {
  agents?: Agent[];
}

// Custom node component definition
const CustomNode = ({ data }: { data: { label: string; task?: string; status: string } }) => (
  <div className="text-center">
    <div className="font-semibold">{data.label}</div>
    {data.task && (
      <div className="text-sm text-gray-400 mt-1">
        {data.task}
      </div>
    )}
    <div className={`text-xs mt-1 ${
      data.status === 'running' ? 'text-green-400' :
      data.status === 'paused' ? 'text-yellow-400' :
      'text-gray-400'
    }`}>
      {data.status.toUpperCase()}
    </div>
  </div>
);

// Initialize positions Map and nodeTypes outside component
const initialPositions = new Map<string, { x: number; y: number }>();
const nodeTypes = {
  default: CustomNode,
};

const getNodeStyle = (status: string) => {
  const baseStyle = {
    padding: 10,
    borderRadius: 5,
    border: '1px solid',
    background: 'rgba(17, 17, 17, 0.9)',
  };

  switch (status) {
    case 'running':
      return { ...baseStyle, borderColor: 'rgba(34, 197, 94, 0.5)' };
    case 'paused':
      return { ...baseStyle, borderColor: 'rgba(234, 179, 8, 0.5)' };
    default:
      return { ...baseStyle, borderColor: 'rgba(107, 114, 128, 0.5)' };
  }
};

function NodeGraphContent({ agents = [] }: NodeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [positions] = useState(initialPositions);

  // Memoize node positions for performance
  const getNodePosition = useMemo(() => (id: string) => {
    if (!positions.has(id)) {
      positions.set(id, {
        x: 200 + Math.random() * 400,
        y: 200 + Math.random() * 400,
      });
    }
    return positions.get(id) || { x: 0, y: 0 };
  }, [positions]);

  useEffect(() => {
    // Safely handle empty or undefined agents
    if (!Array.isArray(agents) || agents.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Update nodes with current agent data
    const newNodes: Node[] = agents.map((agent) => ({
      id: agent.id,
      type: 'default',
      position: getNodePosition(agent.id),
      data: {
        label: agent.name,
        task: agent.currentTask,
        status: agent.status,
      },
      style: getNodeStyle(agent.status),
    }));

    // Create edges based on agent connections
    const newEdges: Edge[] = agents.flatMap((agent) =>
      (agent.connections || []).map((targetId) => ({
        id: `${agent.id}-${targetId}`,
        source: agent.id,
        target: targetId,
        animated: agent.status === 'running',
        style: { stroke: '#a855f7', strokeWidth: 2, opacity: 0.5 },
      }))
    );

    setNodes(newNodes);
    setEdges(newEdges);
  }, [agents, getNodePosition]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background
          gap={12}
          size={1}
          style={{ opacity: 0.1 }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}

// Export wrapped component with ErrorBoundary
export function NodeGraph(props: NodeGraphProps) {
  return (
    <ErrorBoundary>
      <NodeGraphContent {...props} />
    </ErrorBoundary>
  );
}