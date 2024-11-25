import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface WebSocketStatus {
  connected: boolean;
  lastError?: string;
  reconnectAttempt: number;
}

export function useWebSocket(url: string) {
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    reconnectAttempt: 0
  });
  const socket = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const heartbeatInterval = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const updateStatus = (update: Partial<WebSocketStatus>) => {
    setStatus(prev => ({ ...prev, ...update }));
    console.log('WebSocket Status:', { ...status, ...update });
  };

  const calculateBackoff = (attempt: number) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc., with a max of 30s
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  };

  useEffect(() => {
    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.hostname}:5000/ws`);
        socket.current = ws;

        // Setup heartbeat ping
        const setupHeartbeat = () => {
          heartbeatInterval.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 15000);
        };

        ws.onopen = () => {
          updateStatus({ 
            connected: true, 
            reconnectAttempt: 0,
            lastError: undefined 
          });
          reconnectAttempts.current = 0;
          setupHeartbeat();
          toast({
            title: "Connected",
            description: "WebSocket connection established",
            duration: 3000,
          });
        };

        ws.onclose = (event) => {
          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
          }

          const nextAttempt = reconnectAttempts.current + 1;
          const wasConnected = status.connected;
          
          updateStatus({ 
            connected: false,
            reconnectAttempt: nextAttempt,
            lastError: `Connection closed: ${event.reason || 'Unknown reason'}`
          });
          
          if (nextAttempt < maxReconnectAttempts) {
            reconnectAttempts.current = nextAttempt;
            const delay = calculateBackoff(nextAttempt);
            console.log(`Attempting reconnect in ${delay}ms (attempt ${nextAttempt}/${maxReconnectAttempts})`);
            
            if (wasConnected) {
              toast({
                title: "Connection Lost",
                description: "Attempting to reconnect...",
                duration: 3000,
              });
            }
            
            setTimeout(connect, delay);
          } else {
            toast({
              title: "Connection Failed",
              description: "Unable to establish WebSocket connection after multiple attempts",
              variant: "destructive",
              duration: 5000,
            });
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          updateStatus({ 
            lastError: 'Connection error occurred' 
          });
          toast({
            title: "WebSocket Error",
            description: "Failed to connect to simulation server",
            variant: "destructive",
            duration: 5000,
          });
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to establish WebSocket connection",
          variant: "destructive",
        });
      }
    };

    connect();

    return () => {
      if (socket.current) {
        socket.current.close();
      }
    };
  }, [url, toast]);

  return {
    socket: socket.current,
    status,
  };
}
