import { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface Agent {
  id: string;
  name: string;
  status: string;
  connections: string[];
}

interface NodeGraphProps {
  agents: Agent[];
}

export function NodeGraph({ agents }: NodeGraphProps) {
  const nodes: Node[] = agents.map((agent) => ({
    id: agent.id,
    type: 'default',
    position: { x: Math.random() * 500, y: Math.random() * 500 },
    data: { label: agent.name },
    style: {
      background: '#1a1a1a',
      color: '#fff',
      border: '1px solid rgba(147, 51, 234, 0.3)',
      borderRadius: '8px',
      padding: '10px',
    },
  }));

  const edges: Edge[] = agents.flatMap((agent) =>
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
    }))
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        connectionLineType={ConnectionLineType.Straight}
        deleteKeyCode={null}
        minZoom={0.2}
        maxZoom={4}
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
