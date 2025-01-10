import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/context/UserContext';

interface Agent {
  id: string;
  name: string;
  status: string;
  currentTask?: string;
  connections: string[];
}

interface Log {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'interaction' | 'behavior';
  message: string;
}

interface SimulationMetrics {
  totalInteractions: number;
  activeAgents: number;
  goalCompletionRate: number;
  averageProcessingTime: number;
}

// Type for WebSocket message payloads
interface WebSocketMessage {
  type: 'agents' | 'agentState' | 'log' | 'status' | 'metrics';
  payload: any;
}

export function useSimulation() {
  const { loadLoader, stopLoader } = useUser();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    totalInteractions: 0,
    activeAgents: 0,
    goalCompletionRate: 0,
    averageProcessingTime: 0
  });
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
  const { socket, status: wsStatus } = useWebSocket(wsUrl);
  const { toast } = useToast();

  useEffect(() => {
    if (!socket) return;

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        
        if (!data.type || !data.payload) {
          console.error('Invalid message format received:', data);
          return;
        }

        console.log('[WebSocket] Received message:', data);
        
        switch (data.type) {
          case 'agents':
            setAgents(Array.isArray(data.payload) ? data.payload : null);
            stopLoader();
            break;
          case 'agentState':
            setAgents(prev => {
              if (!Array.isArray(prev)) return [];
              return prev.map(agent => 
                agent?.id === data.payload?.id 
                  ? { ...agent, ...data.payload }
                  : agent
              ).filter(Boolean);
            });
            break;
          case 'log':
            console.log('[WebSocket] Processing log:', data.payload);
            setLogs(prev => {
              // Ensure data.payload has all required fields
              if (!data.payload?.id || !data.payload?.type || !data.payload?.message) {
                console.error('[WebSocket] Invalid log format:', data.payload);
                return prev;
              }

              const newLog = {
                id: data.payload.id,
                timestamp: data.payload.timestamp || new Date().toISOString(),
                type: data.payload.type as 'info' | 'warning' | 'error' | 'interaction' | 'behavior',
                message: data.payload.message
              };

              console.log('[WebSocket] Adding new log:', newLog);
              const newLogs = [...prev, newLog];
              return newLogs.slice(-100); // Keep last 100 logs
            });
            break;
          case 'status':
            setSimulationStatus(data.payload);
            break;
          case 'metrics':
            setMetrics(data.payload);
            break;
          default:
            console.warn('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
  }, [socket]);

  const startSimulation = () => {
    if (!wsStatus.connected) {
      toast({
        title: "Connection Error",
        description: "Cannot start simulation: WebSocket not connected",
        variant: "destructive",
      });
      return;
    }
    socket?.send(JSON.stringify({ command: 'start' }));
  };

  const pauseSimulation = () => {
    socket?.send(JSON.stringify({ command: 'pause' }));
  };

  const resetSimulation = () => {
    socket?.send(JSON.stringify({ command: 'reset' }));
    setLogs([]);
    setMetrics({
      totalInteractions: 0,
      activeAgents: 0,
      goalCompletionRate: 0,
      averageProcessingTime: 0
    });
  };

  const updateWorldContext = (contextData: any) => {
    if (!wsStatus.connected) {
      toast({
        title: "Connection Error",
        description: "Cannot update world context: WebSocket not connected",
        variant: "destructive",
      });
      return;
    }
    socket?.send(JSON.stringify({
      command: 'updateWorldContext',
      payload: contextData
    }));
  };

  const deployAgent = (agentData: { name: string; description: string; goals: string ,userId:string}) => {
    if (!wsStatus.connected) {
      toast({
        title: "Connection Error",
        description: "Cannot deploy agent: WebSocket not connected",
        variant: "destructive",
      });
      return;
    }
    loadLoader();
    socket?.send(JSON.stringify({
      command: 'deploy',
      payload: agentData
    }));
  };

  const exportAgentData = (agentId: string) => {
    if (!wsStatus.connected) {
      toast({
        title: "Connection Error",
        description: "Cannot export agent data: WebSocket not connected",
        variant: "destructive",
      });
      return;
    }
    socket?.send(JSON.stringify({
      command: 'exportData',
      payload: { agentId }
    }));
  };

  const terminateAgent = (agentId: string) => {
    if (!wsStatus.connected) {
      toast({
        title: "Connection Error",
        description: "Cannot terminate agent: WebSocket not connected",
        variant: "destructive",
      });
      return;
    }
    socket?.send(JSON.stringify({
      command: 'terminate',
      payload: { agentId }
    }));
  };

  return {
    agents,
    logs,
    metrics,
    simulationStatus,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    deployAgent,
    updateWorldContext,
    exportAgentData,
    terminateAgent,
    wsStatus,
  };
}
