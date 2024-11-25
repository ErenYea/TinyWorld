import { useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Handle,
  Position as FlowPosition,
  ConnectionMode,
  SelectionMode,
} from 'reactflow';
import { ErrorBoundary } from './ErrorBoundary';
import 'reactflow/dist/style.css';

interface Agent {
  id: string;
  name: string;
  status: string;
  currentTask?: string;
  connections: string[];
  description?: string;
}

interface NodeGraphProps {
  agents: Agent[] | null | undefined;
}

// Custom node component definition
interface NodeData {
  label: string;
  task?: string;
  status: string;
  description?: string;
  interactionCount?: number;
  lastInteraction?: string;
}

const CustomNode = ({ data }: { data: NodeData }) => (
  <div 
    className="text-center group relative cursor-pointer"
    title={data.description}
  >
    <Handle type="target" position={FlowPosition.Top} id="target" className="!bg-purple-400" />
    <div className="node-enter">
      <div className="font-semibold">{data.label}</div>
      {data.task && (
        <div className="text-sm text-gray-400 mt-1 max-w-[200px] truncate">
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
      <div className="mt-2">
        {data.interactionCount !== undefined && (
          <div className="text-xs text-purple-400">
            Interactions: {data.interactionCount}
          </div>
        )}
        {data.lastInteraction && (
          <div className="text-xs text-gray-400">
            Last: {data.lastInteraction}
          </div>
        )}
      </div>
      <div className="absolute hidden group-hover:block bg-gray-900/95 text-white p-3 rounded-md shadow-lg z-50 w-64 -translate-x-1/2 left-1/2 mt-2">
        <p className="text-sm font-medium mb-2">{data.description}</p>
        {data.task && <p className="text-xs text-gray-300">Current Task: {data.task}</p>}
      </div>
    </div>
    <Handle type="source" position={FlowPosition.Bottom} id="source" className="!bg-purple-400" />
  </div>
);

// Define types at the top level
type Position = { x: number; y: number };
type NodePositions = Map<string, Position>;

// Initialize node types at the top level
const nodeTypes: Record<string, React.FC<any>> = {
  default: CustomNode,
};

// Initialize positions Map
const initialPositions: NodePositions = new Map();

const getNodeStyle = (status: string) => {
  const baseStyle = {
    padding: 10,
    borderRadius: 5,
    border: '2px solid',
    background: 'rgba(17, 17, 17, 0.9)',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
    transition: 'all 0.3s ease',
  };

  switch (status) {
    case 'running':
      return { 
        ...baseStyle, 
        borderColor: 'rgba(34, 197, 94, 0.7)',
        boxShadow: '0 0 15px rgba(34, 197, 94, 0.3)',
        animation: 'pulse 2s infinite ease-in-out'
      };
    case 'paused':
      return { 
        ...baseStyle, 
        borderColor: 'rgba(234, 179, 8, 0.7)',
        boxShadow: '0 0 15px rgba(234, 179, 8, 0.3)'
      };
    default:
      return { 
        ...baseStyle, 
        borderColor: 'rgba(107, 114, 128, 0.7)',
        boxShadow: '0 0 10px rgba(107, 114, 128, 0.3)'
      };
  }
};

function NodeGraphContent({ agents }: NodeGraphProps) {
  if (!agents) {
    return <div>No agents available</div>;
  }
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
        description: agent.description || 'No description available',
      },
      style: getNodeStyle(agent.status),
    }));

    // Create edges based on agent connections
    const newEdges: Edge[] = agents.flatMap((agent) =>
      (agent.connections || []).map((targetId) => ({
        id: `${agent.id}-${targetId}`,
        source: agent.id,
        target: targetId,
        sourceHandle: 'source',
        targetHandle: 'target',
        animated: agent.status === 'running',
        type: 'smoothstep',
        style: { 
          stroke: '#a855f7', 
          strokeWidth: 2, 
          opacity: 0.5,
          strokeDasharray: '5 5',
        },
        label: 'Interacting',
        labelStyle: { 
          fill: '#a855f7', 
          fontSize: 10,
          fontFamily: 'monospace'
        },
        labelBgStyle: { 
          fill: 'rgba(17, 17, 17, 0.9)',
          fillOpacity: 0.7,
          rx: 4,
        },
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
        draggable={true}
        selectionMode={SelectionMode.None}
        selectNodesOnDrag={false}
        className="nodrag"
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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

// Export the component directly with ErrorBoundary
export function NodeGraph(props: NodeGraphProps) {
  return (
    <ErrorBoundary>
      <div className="h-full w-full">
        <NodeGraphContent {...props} />
      </div>
    </ErrorBoundary>
  );
}