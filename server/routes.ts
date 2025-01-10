import type { Express } from "express";
import { Server } from "http";
import { db } from "../db";
import { agents, simulationLogs, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocketServer, WebSocket } from "ws";
import { SimulationManager } from "./simulation";
import { privy } from "./privyclient";
import bcrypt from 'bcrypt';

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
            
            await broadcastSystemLog('info', `Agent "${data.payload.name}" deployed successfully`);
            
            broadcastToAll(wss, {
              type: 'agents',
              payload: await getAgents(user.id)
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
    sendInitialState(ws,user.id);
  });

  // Add login route
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login request received:', req.body);
    try {
      const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
      console.log('User:', user);

      if (user.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, user[0].password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate a JWT token (this is a placeholder, replace with actual JWT generation logic)
      

      return res.status(200).json({ 
        message: 'Login successful', 
        user: {
          username: user[0].username,
          email: user[0].email
        } 
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Login failed', error: (error as Error).message });
    }
    
  });

  // Add signup route
  app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;

    try {
      // Check if email already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(200).json({ error: "signup_failed" ,message: 'Email already exists' });
      }
      // Replace this with your actual user creation logic
      const newUser = await db.insert(users).values({
        username,
        email,
        password: await bcrypt.hash(password, 10), // Note: In a real application, ensure to hash the password before storing it
      }).returning();

      return res.status(201).json({ 
        message: 'Signup successful', 
        user: {
          username: newUser[0].username,
          email: newUser[0].email
        } 
      });
    } catch (error) {
      if (error.code === '23505') { // Assuming PostgreSQL duplicate key error code
        return res.status(409).json({ message: 'Signup failed',error:'Username or email already exists' });
      }
      console.error('Signup error:', error);
      return res.status(500).json({ message: 'Signup failed', error: (error as Error).message });
    }
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
