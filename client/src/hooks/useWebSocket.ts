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
  const maxReconnectAttempts = 5;
  const { toast } = useToast();

  const updateStatus = (update: Partial<WebSocketStatus>) => {
    setStatus(prev => ({ ...prev, ...update }));
    console.log('WebSocket Status:', { ...status, ...update });
  };

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(`ws://${window.location.hostname}:5000/ws`);
        socket.current = ws;

        ws.onopen = () => {
          updateStatus({ 
            connected: true, 
            reconnectAttempt: 0,
            lastError: undefined 
          });
          reconnectAttempts.current = 0;
          toast({
            title: "Connected",
            description: "WebSocket connection established",
            duration: 3000,
          });
        };

        ws.onclose = () => {
          const nextAttempt = reconnectAttempts.current + 1;
          updateStatus({ 
            connected: false,
            reconnectAttempt: nextAttempt,
            lastError: 'Connection closed'
          });
          
          if (nextAttempt < maxReconnectAttempts) {
            reconnectAttempts.current = nextAttempt;
            const delay = 1000 * Math.min(nextAttempt, 5);
            console.log(`Attempting reconnect in ${delay}ms (attempt ${nextAttempt}/${maxReconnectAttempts})`);
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
