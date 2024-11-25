import type { Express } from "express";
import { Server } from "http";
import { db } from "../db";
import { agents, simulationLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocketServer, WebSocket } from "ws";

export function registerRoutes(app: Express, server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });
  
  wss.on('connection', (ws: WebSocket) => {
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    console.log('Client connected');

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

async function sendInitialState(ws: WebSocket) {
  const currentAgents = await getAgents();
  ws.send(JSON.stringify({
    type: 'agents',
    payload: currentAgents
  }));
}

function broadcastToAll(wss: WebSocketServer, data: any) {
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
