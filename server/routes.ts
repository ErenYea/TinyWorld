import type { Express } from "express";
import { Server } from "http";
import { db } from "../db";
import { agents, simulationLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocketServer, WebSocket } from "ws";
import { SimulationManager } from "./simulation";

// Extend WebSocket type to include our custom property
interface CustomWebSocket extends WebSocket {
  isAlive: boolean;
}

export function registerRoutes(app: Express, server: Server) {
  // Initialize WebSocket server with enhanced logging and error handling
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    perMessageDeflate: false,
    clientTracking: true,
    // Enhanced WebSocket server options
    backlog: 50, // Reduced for Replit environment
    maxPayload: 1024 * 1024, // 1MB max payload
    verifyClient: (info, callback) => {
      const clientIp = info.req.socket.remoteAddress;
      console.log(`[WebSocket] New connection attempt from: ${clientIp}`);
      callback(true);
    }
  });

  // Enhanced error handling at server level
  wss.on('error', (error) => {
    console.error('[WebSocket] Server error:', error);
    // Attempt recovery
    setTimeout(() => {
      try {
        wss.close(() => {
          console.log('[WebSocket] Server closed for recovery');
          // The server will be automatically reopened by the HTTP server
        });
      } catch (closeError) {
        console.error('[WebSocket] Error during server recovery:', closeError);
      }
    }, 1000);
  });

  // Add server-level error handling
  wss.on('error', (error) => {
    console.error('[WebSocket] Server encountered an error:', error);
  });

  // Track clients and handle cleanup
  const clients = new Set<WebSocket>();
  
  // Periodic cleanup of dead connections
  const cleanupInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as CustomWebSocket;
      if (!client.isAlive) {
        console.log('[WebSocket] Terminating inactive client');
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  // Log WebSocket server events
  wss.on('listening', () => {
    console.log('[WebSocket] Server is listening and ready for connections');
  });

  wss.on('error', (error) => {
    console.error('[WebSocket] Server error:', error);
  });

  // Initialize simulation manager after WSS is ready
  // Initialize simulation manager and create function for broadcasting logs
  const simulationManager = new SimulationManager(wss);

  async function broadcastSystemLog(type: 'info' | 'warning' | 'error', message: string) {
    const log = await db.insert(simulationLogs)
      .values({
        type,
        message,
      })
      .returning();
    
    console.log(`[WebSocket] Broadcasting system log: ${message}`);
    broadcastToAll(wss, {
      type: 'log',
      payload: {
        ...log[0],
        timestamp: new Date().toISOString()
      }
    });
  }

  // Log when the server is ready
  console.log('[WebSocket] Server initialized successfully');

  wss.on('connection', (wsRaw: WebSocket, req) => {
    const ws = wsRaw as CustomWebSocket;
    const clientIp = req.socket.remoteAddress;
    const clientId = Math.random().toString(36).substr(2, 9);
    
    // Initialize connection state
    ws.isAlive = true;
    console.log(`WebSocket client connected - ID: ${clientId}, IP: ${clientIp}`);
    
    // Setup heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
      console.log(`Heartbeat received from client ${clientId}`);
    });

    // Error handling
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      ws.isAlive = false;
      
      // Only try to send error message if the connection is still open
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'error',
            payload: 'An error occurred in the connection'
          }));
        } catch (sendError) {
          console.error('Failed to send error message to client:', sendError);
        }
      }
      
      // Force close the connection on error
      try {
        ws.terminate();
      } catch (closeError) {
        console.error('Error while terminating connection:', closeError);
      }
    });

    // Setup ping-pong heartbeat
    const pingInterval = setInterval(() => {
      if (!ws.isAlive) {
        console.log(`Client ${clientId} is not responding, terminating connection`);
        clearInterval(pingInterval);
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('message', async (message) => {
      const data = JSON.parse(message.toString());
      
      switch (data.command) {
        case 'deploy':
          try {
            const agent = await db.insert(agents).values({
              name: data.payload.name,
              description: data.payload.description,
              goals: data.payload.goals,
            }).returning();
            
            await broadcastSystemLog('info', `Agent "${data.payload.name}" deployed successfully`);
            
            broadcastToAll(wss, {
              type: 'agents',
              payload: await getAgents()
            });
          } catch (error: any) {
            console.error('[WebSocket] Failed to deploy agent:', error);
            await broadcastSystemLog('error', `Failed to deploy agent: ${error?.message || 'Unknown error'}`);
          }
          break;

        case 'start':
          try {
            // Only update idle agents to running state
            await db.update(agents)
              .set({ status: 'running' })
              .where(eq(agents.status, 'idle'));

            // Start simulation loop
            await simulationManager.startSimulationLoop();
            
            broadcastToAll(wss, {
              type: 'status',
              payload: 'running'
            });

            await broadcastSystemLog('info', 'Simulation started');
          } catch (error: any) {
            console.error('[WebSocket] Failed to start simulation:', error);
            await broadcastSystemLog('error', `Failed to start simulation: ${error?.message || 'Unknown error'}`);
          }
          break;

        case 'pause':
          await simulationManager.stop();
          break;

        case 'reset':
          await simulationManager.reset();
          break;

        case 'exportData':
          try {
            const { agentId } = data.payload;
            await simulationManager.exportAgentData(agentId);
            await broadcastSystemLog('info', `Agent data exported for agent ID: ${agentId}`);
          } catch (error: any) {
            console.error('[WebSocket] Failed to export agent data:', error);
            await broadcastSystemLog('error', `Failed to export agent data: ${error?.message || 'Unknown error'}`);
          }
          break;

        case 'terminate':
          try {
            const { agentId } = data.payload;
            await simulationManager.terminateAgent(agentId);
            await broadcastSystemLog('info', `Agent terminated: ${agentId}`);
          } catch (error: any) {
            console.error('[WebSocket] Failed to terminate agent:', error);
            await broadcastSystemLog('error', `Failed to terminate agent: ${error?.message || 'Unknown error'}`);
          }
          break;

        case 'analyzeDiscussion':
          try {
            const { query } = data.payload;
            const analysis = await simulationManager.analyzeDiscussion(query);
            
            broadcastToAll(wss, {
              type: 'analysis',
              payload: analysis
            });
          } catch (error) {
            console.error('[WebSocket] Failed to analyze discussion:', error);
            await broadcastSystemLog('error', `Failed to analyze discussion: ${error?.message || 'Unknown error'}`);
          }
          break;

        case 'updateWorldContext':
          try {
            const worldContext = data.payload;
            simulationManager.updateWorldState(worldContext);
            
            await broadcastSystemLog('info', `World context updated: ${worldContext.name}`);
            
            broadcastToAll(wss, {
              type: 'worldContext',
              payload: worldContext
            });
          } catch (error: any) {
            console.error('[WebSocket] Failed to update world context:', error);
            await broadcastSystemLog('error', `Failed to update world context: ${error?.message || 'Unknown error'}`);
          }
          break;
      }
    });

    ws.on('close', (code: number, reason: string) => {
      ws.isAlive = false;
      clearInterval(pingInterval);
      console.log(`Client ${clientId} disconnected - Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    });

    // Send initial state
    sendInitialState(ws);
  });
}

async function getAgents() {
  return await db.select().from(agents);
}

async function sendInitialState(ws: CustomWebSocket) {
  const currentAgents = await getAgents();
  ws.send(JSON.stringify({
    type: 'agents',
    payload: currentAgents
  }));
}

function broadcastToAll(wss: WebSocketServer, data: any) {
  wss.clients.forEach((client) => {
    const customClient = client as CustomWebSocket;
    if (customClient.readyState === WebSocket.OPEN) {
      try {
        customClient.send(JSON.stringify(data));
      } catch (error) {
        console.error('Failed to broadcast to client:', error);
      }
    }
  });
}
