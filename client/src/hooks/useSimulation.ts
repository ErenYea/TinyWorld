import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: string;
  name: string;
  status: string;
  connections: string[];
}

interface Log {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error';
  message: string;
}

export function useSimulation() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
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
        case 'log':
          setLogs(prev => [...prev, {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            ...data.payload
          }]);
          break;
        case 'status':
          setSimulationStatus(data.payload);
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
    simulationStatus,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    deployAgent,
    wsStatus,
  };
}
