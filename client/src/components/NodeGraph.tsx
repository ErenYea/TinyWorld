import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface Agent {
  id: string;
  name: string;
  status: string;
  currentTask?: string;
  connections: string[];
}

interface NodeGraphProps {
  agents: Agent[];
}

const getNodeStyle = (status: string) => {
  const baseStyle = {
    background: '#1a1a1a',
    color: '#fff',
    border: '2px solid',
    borderRadius: '8px',
    padding: '10px',
    width: 180,
  };

  switch (status) {
    case 'running':
      return {
        ...baseStyle,
        borderColor: 'rgba(34, 197, 94, 0.5)', // green
        boxShadow: '0 0 15px rgba(34, 197, 94, 0.3)',
      };
    case 'paused':
      return {
        ...baseStyle,
        borderColor: 'rgba(234, 179, 8, 0.5)', // yellow
        boxShadow: '0 0 15px rgba(234, 179, 8, 0.3)',
      };
    default:
      return {
        ...baseStyle,
        borderColor: 'rgba(147, 51, 234, 0.3)', // purple
      };
  }
};

const CustomNode = ({ data }: { data: { label: string; task?: string; status: string } }) => (
  <div className="text-center">
    <div className="font-semibold">{data.label}</div>
    {data.task && (
      <div className="text-xs mt-1 text-purple-300 opacity-80">
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

export function NodeGraph({ agents }: NodeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [positions] = useState(new Map());

  useEffect(() => {
    // Generate or retrieve consistent positions for nodes
    agents.forEach((agent) => {
      if (!positions.has(agent.id)) {
        positions.set(agent.id, {
          x: 200 + Math.random() * 400,
          y: 200 + Math.random() * 400,
        });
      }
    });

    // Update nodes with current agent data
    const newNodes: Node[] = agents.map((agent) => ({
      id: agent.id,
      type: 'default',
      position: positions.get(agent.id),
      data: {
        label: agent.name,
        task: agent.currentTask,
        status: agent.status,
      },
      style: getNodeStyle(agent.status),
    }));

    // Create edges for agent connections
    const newEdges: Edge[] = agents.flatMap((agent) =>
      agent.connections.map((target) => ({
        id: `${agent.id}-${target}`,
        source: agent.id,
        target,
        type: 'straight',
        animated: true,
        style: {
          stroke: '#a855f7',
          strokeWidth: 2,
        },
        labelStyle: { fill: '#a855f7' },
      }))
    );

    setNodes(newNodes);
    setEdges(newEdges);
  }, [agents, setNodes, setEdges]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={{ default: CustomNode }}
        connectionLineType={ConnectionLineType.Straight}
        deleteKeyCode={null}
        minZoom={0.2}
        maxZoom={4}
        fitView
      >
        <Background
          color="#a855f7"
          gap={16}
          size={1}
          style={{ opacity: 0.1 }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
