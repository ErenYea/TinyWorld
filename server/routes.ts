import type { Express } from "express";
import { Server } from "http";
import { db } from "../db";
import { agents, simulationLogs, users } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { WebSocketServer, WebSocket } from "ws";
import { SimulationManager } from "./simulation";
import { privy } from "./privyclient";

// Extend WebSocket type to include our custom property
interface CustomWebSocket extends WebSocket {
  isAlive: boolean;
  userId: string;
  simulationManager: SimulationManager;
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
  // const simulationManager = new SimulationManager(wss);

  async function broadcastSystemLog(type: 'info' | 'warning' | 'error', message: string,ws:WebSocket) {
    const log = await db.insert(simulationLogs)
      .values({
        type,
        message,
      })
      .returning();
    
    console.log(`[WebSocket] Broadcasting system log: ${message}`);
    broadcastToAll(ws, {
      type: 'log',
      payload: {
        ...log[0],
        timestamp: new Date().toISOString()
      }
    });
  }

  // Log when the server is ready
  console.log('[WebSocket] Server initialized successfully');

  wss.on('connection', async (wsRaw: WebSocket, req) => {
    const ws = wsRaw as CustomWebSocket;
    const clientIp = req.socket.remoteAddress;
    const urlParams = new URLSearchParams(req.url!.split('?')[1]);
    const userId = urlParams.get('id');
    if(!userId){
      throw new Error('User ID not found');
    }
    const clientId = Math.random().toString(36).substr(2, 9);
    console.log(`Query received from client ${clientId}: ${userId}`);
    const userIdDecoded = decodeURIComponent(userId);
    const user = await privy.getUserById(userIdDecoded);
    if(!user){
      throw new Error('User not found');
    }
    // Initialize connection state
    ws.isAlive = true;
    ws.simulationManager = new SimulationManager(ws,user.id);
    console.log(`WebSocket client connected - ID: ${clientId}, IP: ${clientIp}`);
    ws.userId = userIdDecoded;
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
            const userId = data.payload.userId;
            const user = await privy.getUserById(userId);
            if (!user) {  
              throw new Error('User not found');
            }
            const agent = await db.insert(agents).values({
              name: data.payload.name,
              description: data.payload.description,
              goals: data.payload.goals,
              userId: user.id
            }).returning();
            
            await broadcastSystemLog('info', `Agent "${data.payload.name}" deployed successfully`,ws);
            
            broadcastToAll(ws, {
              type: 'agents',
              payload: await getAgents(user.id)
            });
          } catch (error: any) {
            console.error('[WebSocket] Failed to deploy agent:', error);
            await broadcastSystemLog('error', `Failed to deploy agent: ${error?.message || 'Unknown error'}`,ws);
          }
          break;

        case 'start':
          try {
            // Only update idle agents to running state
            await db.update(agents)
              .set({ status: 'running' })
              .where(and(eq(agents.status, 'idle'),eq(agents.userId,user.id)));

            // Start simulation loop
            await ws.simulationManager.startSimulationLoop();
            
            broadcastToAll(ws, {
              type: 'status',
              payload: 'running'
            });

            await broadcastSystemLog('info', 'Simulation started',ws);
          } catch (error: any) {
            console.error('[WebSocket] Failed to start simulation:', error);
            await broadcastSystemLog('error', `Failed to start simulation: ${error?.message || 'Unknown error'}`,ws);
          }
          break;

        case 'pause':
          await ws.simulationManager.stop();
          break;

        case 'reset':
          await ws.simulationManager.reset();
          break;

        case 'exportData':
          try {
            const { agentId } = data.payload;
            await ws.simulationManager.exportAgentData(agentId);
            await broadcastSystemLog('info', `Agent data exported for agent ID: ${agentId}`,ws);
          } catch (error: any) {
            console.error('[WebSocket] Failed to export agent data:', error);
            await broadcastSystemLog('error', `Failed to export agent data: ${error?.message || 'Unknown error'}`,ws);
          }
          break;

        case 'terminate':
          try {
            const { agentId } = data.payload;
            await ws.simulationManager.terminateAgent(agentId);
            await broadcastSystemLog('info', `Agent terminated: ${agentId}`,ws);
          } catch (error: any) {
            console.error('[WebSocket] Failed to terminate agent:', error);
            await broadcastSystemLog('error', `Failed to terminate agent: ${error?.message || 'Unknown error'}`,ws);
          }
          break;

        // case 'analyzeDiscussion':
        //   try {
        //     const { query } = data.payload;
        //     const analysis = await ws.simulationManager.analyzeDiscussion(query);
            
        //     broadcastToAll(ws, {
        //       type: 'analysis',
        //       payload: analysis
        //     });
        //   } catch (error) {
        //     console.error('[WebSocket] Failed to analyze discussion:', error);
        //     await broadcastSystemLog('error', `Failed to analyze discussion: ${(error as Error)?.message || 'Unknown error'}`,ws);
        //   }
        //   break;

        case 'updateWorldContext':
          try {
            const worldContext = data.payload;
            ws.simulationManager.updateWorldState(worldContext);
            
            await broadcastSystemLog('info', `World context updated: ${worldContext.name}`,ws);
            
            broadcastToAll(ws, {
              type: 'worldContext',
              payload: worldContext
            });
          } catch (error: any) {
            console.error('[WebSocket] Failed to update world context:', error);
            await broadcastSystemLog('error', `Failed to update world context: ${error?.message || 'Unknown error'}`,ws);
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
    sendInitialState(ws,user.id);
  });


}

async function getAgents(userId: string) {
  return await db.select().from(agents).where(eq(agents.userId, userId));
}

async function sendInitialState(ws: CustomWebSocket,userId:string) {
  const currentAgents = await getAgents(userId);
  ws.send(JSON.stringify({
    type: 'agents',
    payload: currentAgents
  }));
}

function broadcastToAll(wss: WebSocket, data: any) {
  wss.send(JSON.stringify(data));
}

