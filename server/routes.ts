import type { Express } from "express";
import { Server } from "http";
import { db } from "../db";
import { agents, simulationLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocketServer, WebSocket } from "ws";

// Extend WebSocket type to include our custom property
interface CustomWebSocket extends WebSocket {
  isAlive: boolean;
}

export function registerRoutes(app: Express, server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    verifyClient: (info, callback) => {
      const origin = info.origin || 'unknown';
      console.log(`WebSocket connection attempt from origin: ${origin}`);
      callback(true, 200, 'Connection authorized');
    }
  });
  
  wss.on('connection', (ws: CustomWebSocket, req) => {
    const clientIp = req.socket.remoteAddress;
    const clientId = Math.random().toString(36).substr(2, 9);
    console.log(`WebSocket client connected - ID: ${clientId}, IP: ${clientIp}`);
    
    // Setup heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Error handling
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      try {
        ws.send(JSON.stringify({
          type: 'error',
          payload: 'An error occurred in the connection'
        }));
      } catch (sendError) {
        console.error('Failed to send error message to client:', sendError);
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
          const agent = await db.insert(agents).values({
            name: data.payload.name,
            description: data.payload.description,
            goals: data.payload.goals,
          }).returning();
          
          broadcastToAll(wss, {
            type: 'agents',
            payload: await getAgents()
          });
          break;

        case 'start':
          await db.update(agents)
            .set({ status: 'running' })
            .where(eq(agents.status, 'idle'));
          
          broadcastToAll(wss, {
            type: 'status',
            payload: 'running'
          });
          break;

        case 'pause':
          await db.update(agents)
            .set({ status: 'paused' })
            .where(eq(agents.status, 'running'));
          
          broadcastToAll(wss, {
            type: 'status',
            payload: 'paused'
          });
          break;

        case 'reset':
          await db.update(agents)
            .set({ status: 'idle' });
          
          broadcastToAll(wss, {
            type: 'status',
            payload: 'idle'
          });
          break;
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
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
  wss.clients.forEach((client: CustomWebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
