import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { usePrivy } from '@privy-io/react-auth';
import { useUser } from '@/context/UserContext';

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
  const { loadLoader } = useUser();
  const socket = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3; // Reduced to 3 for Replit environment
  const heartbeatInterval = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const { user } = usePrivy();

  // Function to construct WebSocket URL with proper protocol
  const getWebSocketUrl = (baseUrl: string) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}/ws`;
  };

  const updateStatus = (update: Partial<WebSocketStatus>) => {
    setStatus(prev => ({ ...prev, ...update }));
    console.log('[WebSocket] Status Update:', { ...status, ...update });
  };

  const calculateBackoff = (attempt: number) => {
    // Even shorter backoff times for Replit: 0.25s, 0.5s, 1s
    const baseDelay = 250; // Start with 250ms
    const maxDelay = 1000; // Max delay of 1s
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  };

  useEffect(() => {
    console.log('useWebSocket',user);
    // const user = JSON.parse(localStorage.getItem('user') || '{}');
    const connect = async (userId:string) => {
      try {
        // Initial delay reduced for faster reconnection
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use the provided URL directly instead of constructing it
        console.log('[WebSocket] Connecting to:', url);
        
        const emailtosend = encodeURIComponent(userId); // URL-encode the email
        const urlWithParams = `${url}?id=${emailtosend}`;
        const ws = new WebSocket(urlWithParams);

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
            
            setTimeout(() => connect(userId), delay);
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
          const errorMessage = error instanceof ErrorEvent ? error.message : 'Unknown error';
          console.error('[WebSocket] Error:', errorMessage);
          
          // Determine specific error message based on connection state
          let errorDescription = "Failed to connect to simulation server";
          if (ws.readyState === WebSocket.CLOSING) {
            errorDescription = "Connection is closing unexpectedly";
          } else if (ws.readyState === WebSocket.CLOSED) {
            errorDescription = "Connection was closed unexpectedly";
          }
          
          updateStatus({ 
            lastError: errorDescription,
            connected: false
          });
          
          toast({
            title: "WebSocket Error",
            description: errorDescription,
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
    if(user?.id){
      loadLoader();
      connect(user.id);
    }
    if (socket.current && !user){
      socket.current.close();
    }

    return () => {
      if (socket.current) {
        socket.current.close();
      }
    };
  }, [url, toast,user]);

  return {
    socket: socket.current,
    status,
  };
}
