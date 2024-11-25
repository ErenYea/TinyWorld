import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      toast({
        title: "Connected",
        description: "WebSocket connection established",
      });
    };

    ws.onclose = () => {
      setConnected(false);
      toast({
        title: "Disconnected",
        description: "WebSocket connection closed",
        variant: "destructive",
      });
    };

    ws.onerror = (error) => {
      toast({
        title: "WebSocket Error",
        description: "Failed to connect to simulation server",
        variant: "destructive",
      });
    };

    socket.current = ws;

    return () => {
      ws.close();
    };
  }, [url]);

  return {
    socket: socket.current,
    connected,
  };
}
