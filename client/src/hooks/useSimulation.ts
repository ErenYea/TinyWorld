import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useToast } from '@/hooks/use-toast';

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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    totalInteractions: 0,
    activeAgents: 0,
    goalCompletionRate: 0,
    averageProcessingTime: 0
  });
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  
  const { socket, status: wsStatus } = useWebSocket(`ws://${window.location.hostname}`);
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

        switch (data.type) {
          case 'agents':
            setAgents(data.payload || []);
            break;
          case 'agentState':
            setAgents(prev => {
              if (!prev) return [];
              return prev.map(agent => 
                agent.id === data.payload.id 
                  ? { ...agent, ...data.payload }
                  : agent
              );
            });
            break;
          case 'log':
            setLogs(prev => {
              const newLogs = [...prev, {
                id: data.payload.id || crypto.randomUUID(),
                timestamp: data.payload.timestamp || new Date().toISOString(),
                type: data.payload.type,
                message: data.payload.message
              }];
              return newLogs.slice(-100);
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

  const deployAgent = (agentData: { name: string; description: string; goals: string }) => {
    if (!wsStatus.connected) {
      toast({
        title: "Connection Error",
        description: "Cannot deploy agent: WebSocket not connected",
        variant: "destructive",
      });
      return;
    }
    socket?.send(JSON.stringify({
      command: 'deploy',
      payload: agentData
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
    wsStatus,
  };
}
