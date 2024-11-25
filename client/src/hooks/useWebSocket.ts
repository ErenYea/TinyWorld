import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const { toast } = useToast();

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(`ws://${window.location.hostname}:5000/ws`);
        socket.current = ws;

        ws.onopen = () => {
          setConnected(true);
          reconnectAttempts.current = 0;
          toast({
            title: "Connected",
            description: "WebSocket connection established",
          });
        };

        ws.onclose = () => {
          setConnected(false);
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1;
            setTimeout(() => {
              connect();
            }, 1000 * Math.min(reconnectAttempts.current, 5));
          } else {
            toast({
              title: "Connection Failed",
              description: "Unable to establish WebSocket connection after multiple attempts",
              variant: "destructive",
            });
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          toast({
            title: "WebSocket Error",
            description: "Failed to connect to simulation server",
            variant: "destructive",
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
    connected,
  };
}
