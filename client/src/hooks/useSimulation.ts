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
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'agents':
          setAgents(data.payload);
          break;
        case 'agentState':
          setAgents(prev => prev.map(agent => 
            agent.id === data.payload.id 
              ? { ...agent, ...data.payload }
              : agent
          ));
          break;
        case 'log':
          setLogs(prev => {
            const newLogs = [...prev, {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              ...data.payload
            }];
            // Keep only the last 100 logs to prevent memory issues
            return newLogs.slice(-100);
          });
          break;
        case 'status':
          setSimulationStatus(data.payload);
          break;
        case 'metrics':
          setMetrics(data.payload);
          break;
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

  const deployAgent = (agentData: any) => {
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
