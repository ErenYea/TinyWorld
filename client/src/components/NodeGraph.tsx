import React, { useEffect, useState, useMemo, useCallback } from 'react';
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

interface NodeData {
  label: string;
  task?: string;
  status: string;
  description?: string;
  interactionCount?: number;
  lastInteraction?: string;
}

const CustomNode = ({ data }: { data: NodeData }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div 
      className={`group relative cursor-pointer transition-all duration-300 ${
        expanded ? 'node-expanded' : ''
      }`}
      onClick={() => setExpanded(!expanded)}
      title={data.description}
    >
      <Handle type="target" position={FlowPosition.Top} id="target" className="!bg-purple-400" />
      <div className={`node-enter bg-gray-900/90 p-4 rounded-lg border-2 ${
        data.status === 'running' ? 'border-green-400/50 animate-pulse' :
        data.status === 'paused' ? 'border-yellow-400/50' :
        'border-gray-400/50'
      }`}>
        <div className="font-semibold text-white">{data.label}</div>
        {data.task && (
          <div className="text-sm text-gray-300 mt-1 max-w-[200px] truncate">
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
      </div>
      
      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900/95 text-white p-4 rounded-lg shadow-xl z-50 w-72 -translate-x-1/2 left-1/2 mt-3 border border-purple-500/30">
        <div className="relative">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-gray-900/95 border-t border-l border-purple-500/30"></div>
          <p className="text-sm font-medium mb-2 text-purple-400">{data.description}</p>
          {data.task && (
            <div className="mt-2 pt-2 border-t border-purple-500/30">
              <p className="text-xs text-gray-300">Current Task:</p>
              <p className="text-sm text-white">{data.task}</p>
            </div>
          )}
        </div>
      </div>
      
      <Handle type="source" position={FlowPosition.Bottom} id="source" className="!bg-purple-400" />
    </div>
  );
};

type Position = { x: number; y: number };
type NodePositions = Map<string, Position>;

const nodeTypes = {
  default: CustomNode,
} as const;

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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [positions] = useState<NodePositions>(new Map());
  
  const getNodePosition = useCallback((id: string, index: number, total: number) => {
    if (!positions.has(id)) {
      // Calculate position in a circular layout
      const radius = Math.min(800, 600) * 0.4; // 40% of the smaller dimension
      const angle = (2 * Math.PI * index) / total;
      const centerX = 400; // Center of the visualization area
      const centerY = 300;
      
      positions.set(id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
      
      console.log(`[NodeGraph] Positioned node ${id} at angle ${angle}, index ${index}/${total}`);
    }
    return positions.get(id) || { x: centerX, y: centerY };
  }, [positions]);

  useEffect(() => {
    console.log('[NodeGraph] Agents update received:', {
      agentsReceived: agents?.length || 0,
      agentsValid: Array.isArray(agents),
      agentDetails: agents?.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        connections: a.connections?.length || 0
      }))
    });

    if (!Array.isArray(agents) || agents.length === 0) {
      console.log('[NodeGraph] No valid agents to display');
      setNodes([]);
      setEdges([]);
      return;
    }

    // Update nodes with current agent data
    const newNodes: Node[] = agents.map((agent) => ({
      id: agent.id,
      type: 'default',
      position: getNodePosition(agent.id, agents.indexOf(agent), agents.length),
      data: {
        label: agent.name,
        task: agent.currentTask,
        status: agent.status,
        description: agent.description || 'No description available',
      },
      className: `node-${agent.status}`,
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
          stroke: agent.status === 'running' ? '#a855f7' : '#666',
          strokeWidth: agent.status === 'running' ? 3 : 2,
          opacity: agent.status === 'running' ? 0.8 : 0.4,
          strokeDasharray: agent.status === 'running' ? '8 8' : '5 5',
          filter: agent.status === 'running' ? 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))' : 'none',
        },
        className: agent.status === 'running' ? 'edge-particle' : '',
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
  }, [agents, getNodePosition, setNodes, setEdges]);

  if (!agents) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No agents available
      </div>
    );
  }

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
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={false}
        className="nodrag"
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={12}
          size={1}
          style={{ opacity: 0.1 }}
          color="#a855f7"
        />
        <Controls
          showInteractive={false}
          className="bg-gray-900/50 border-purple-500/30 rounded-lg"
        />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as NodeData).status;
            return status === 'running' ? '#22c55e' :
                   status === 'paused' ? '#eab308' : '#6b7280';
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
          style={{
            backgroundColor: 'rgba(17, 17, 17, 0.9)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '0.5rem'
          }}
        />
      </ReactFlow>
    </div>
  );
}

// Export the component with ErrorBoundary
const NodeGraph = React.memo(({ agents }: NodeGraphProps) => {
  useEffect(() => {
    if (agents?.length) {
      console.log('[NodeGraph] Agents updated:', agents.length);
    }
  }, [agents]);
  
  return (
    <ErrorBoundary>
      <div className="h-full w-full relative bg-black/50">
        {agents && agents.length > 0 ? (
          <NodeGraphContent agents={agents} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="mb-4">No agents deployed</p>
              <p className="text-sm">Deploy agents using the panel on the left to start the simulation</p>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

NodeGraph.displayName = 'NodeGraph';

export { NodeGraph };