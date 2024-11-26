import { db } from "../db";
import { agents, simulationLogs } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { WebSocket, WebSocketServer } from "ws";
import type { Log } from "@db/schema";
import { ClaudeService } from "./services/claude";

interface WorldContext {
  name: string;
  description: string;
  rules: string[];
  state: Record<string, any>;
}

interface SimulationMetrics {
  totalInteractions: number;
  activeAgents: number;
  goalCompletionRate: number;
  averageProcessingTime: number;
}

interface AgentState {
  id: string;
  currentTask: string;
  interactionCount: number;
  lastInteractionTime: number;
  processingTime: number;
  connections: Set<string>;
}

type BehaviorPattern = 'ANALYZE' | 'COLLABORATE' | 'OPTIMIZE' | 'LEARN';

export class SimulationManager {
  private wss: WebSocketServer;
  private simulationInterval: NodeJS.Timeout | null = null;
  private agentStates: Map<string, AgentState> = new Map();
  private worldContext: WorldContext;
  private simulationStatus: 'idle' | 'running' | 'paused' = 'idle';
  private metrics: SimulationMetrics = {
    totalInteractions: 0,
    activeAgents: 0,
    goalCompletionRate: 0,
    averageProcessingTime: 0
  };

  constructor(wss: WebSocketServer, context: WorldContext = {
    name: "Default World",
    description: "A simulation environment for AI agents to interact and evolve",
    rules: ["Agents must collaborate to achieve goals", "Agents should respect resource constraints"],
    state: { timestamp: new Date().toISOString() }
  }) {
    this.wss = wss;
    this.worldContext = context;
  }

  public updateWorldState(updates: Partial<Record<string, any>>) {
    this.worldContext.state = {
      ...this.worldContext.state,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    // Broadcast world state update
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'worldState',
          payload: this.worldContext
        }));
      }
    });
  }

  private determineInteraction(agent1Goals: string, agent2Goals: string): boolean {
    // Simple goal compatibility check
    const goals1 = agent1Goals.toLowerCase();
    const goals2 = agent2Goals.toLowerCase();
    return goals1.includes('collaborate') || goals2.includes('collaborate') ||
           goals1.split(' ').some(word => goals2.includes(word));
  }

  private determineBehaviorPattern(goals: string): BehaviorPattern {
    const goalLower = goals.toLowerCase();
    if (goalLower.includes('analyze') || goalLower.includes('study')) return 'ANALYZE';
    if (goalLower.includes('collaborate') || goalLower.includes('work')) return 'COLLABORATE';
    if (goalLower.includes('optimize') || goalLower.includes('improve')) return 'OPTIMIZE';
    return 'LEARN';
  }

  private async processAgentBehavior(agent: any, pattern: BehaviorPattern): Promise<string> {
    const claudeService = ClaudeService.getInstance();
    try {
      const currentMemory = agent.memory || {};
      const context = `
World Context: ${this.worldContext.name}
${this.worldContext.description}
Rules: ${this.worldContext.rules.join('\n')}

Current State:
${JSON.stringify(this.worldContext.state, null, 2)}

You are currently in ${pattern} mode. Consider your goals, the world context, and previous interactions to determine your next action.
`;
      
      const { response, updatedMemory } = await claudeService.generateResponse(
        agent,
        context,
        currentMemory
      );

      // Update agent memory in database
      await db.update(agents)
        .set({ memory: updatedMemory })
        .where(eq(agents.id, agent.id));

      // Update world state with agent's action
      this.updateWorldState({
        lastAgentAction: {
          agentId: agent.id,
          agentName: agent.name,
          action: response,
          timestamp: new Date().toISOString()
        }
      });

      return `[${pattern}] ${response}`;
    } catch (error) {
      console.error('[SimulationManager] Error processing agent behavior:', error);
      return `[${pattern}] Error processing behavior`;
    }
  }

  private updateMetrics(activeAgents: number) {
    this.metrics.activeAgents = activeAgents;
    this.metrics.averageProcessingTime = Array.from(this.agentStates.values())
      .reduce((acc, state) => acc + state.processingTime, 0) / this.agentStates.size || 0;
    
    this.broadcastMetrics();
  }

  private broadcastMetrics() {
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'metrics',
          payload: this.metrics
        }));
      }
    });
  }

  private async updateAgentStatus(agentId: string, newStatus: 'idle' | 'running' | 'paused', errorHandler?: (error: any) => void) {
    try {
      await db.update(agents)
        .set({ status: newStatus })
        .where(eq(agents.id, agentId));

      // Log status change
      const log = await db.insert(simulationLogs)
        .values({
          agentId,
          type: 'info',
          message: `Agent status changed to ${newStatus}`,
        })
        .returning();

      this.broadcastLog(log[0]);
      return true;
    } catch (error) {
      console.error(`[SimulationManager] Failed to update agent status: ${error}`);
      if (errorHandler) {
        errorHandler(error);
      }
      return false;
    }
  }

  public async startSimulationLoop() {
    console.log('[SimulationManager] Starting simulation loop');
    
    try {
      if (this.simulationStatus !== 'idle') {
        console.log('[SimulationManager] Simulation is already running or paused');
        return;
      }

      // Clear any existing interval
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }

      this.simulationStatus = 'running';
      
      // Update all idle agents to running state
      const idleAgents = await db.select()
        .from(agents)
        .where(eq(agents.status, 'idle'));
      
      for (const agent of idleAgents) {
        await this.updateAgentStatus(agent.id, 'running');
      }

      this.simulationInterval = setInterval(async () => {
        try {
          if (this.simulationStatus !== 'running') {
            console.log('[SimulationManager] Simulation paused or stopped');
            return;
          }

          const runningAgents = await db.select()
            .from(agents)
            .where(eq(agents.status, 'running'));

          console.log(`[SimulationManager] Processing ${runningAgents.length} running agents`);

      // Update active agents count
      this.updateMetrics(runningAgents.length);

      for (const agent of runningAgents) {
        try {
          const startTime = Date.now();
          
          // Initialize or get agent state
          if (!this.agentStates.has(agent.id)) {
            this.agentStates.set(agent.id, {
              id: agent.id,
              currentTask: '',
              interactionCount: 0,
              lastInteractionTime: Date.now(),
              processingTime: 0,
              connections: new Set()
            });
          }

          const pattern = this.determineBehaviorPattern(agent.goals);
          const currentBehavior = await this.processAgentBehavior(agent, pattern);
          
          // Process interactions with other agents
          for (const otherAgent of runningAgents) {
            if (agent.id !== otherAgent.id && 
                this.determineInteraction(agent.goals, otherAgent.goals)) {
              
              const agentState = this.agentStates.get(agent.id)!;
              agentState.connections.add(otherAgent.id);
              agentState.interactionCount++;
              this.metrics.totalInteractions++;

              // Log interaction
              const log = await db.insert(simulationLogs)
                .values({
                  agentId: agent.id,
                  type: 'interaction',
                  message: `Agent ${agent.name} is interacting with ${otherAgent.name} - ${currentBehavior}`,
                })
                .returning();

              this.broadcastLog(log[0]);
            }
          }

          // Update agent state
          const agentState = this.agentStates.get(agent.id)!;
          agentState.currentTask = currentBehavior;
          agentState.processingTime = Date.now() - startTime;

          // Verify agent is still in running state
          const currentAgent = await db.select()
            .from(agents)
            .where(eq(agents.id, agent.id))
            .limit(1);

          if (!currentAgent[0] || currentAgent[0].status !== 'running') {
            console.log(`[SimulationManager] Agent ${agent.id} is no longer running, skipping updates`);
            continue;
          }

          // Broadcast agent state
          this.wss.clients.forEach((client: WebSocket) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'agentState',
                payload: {
                  id: agent.id,
                  name: agent.name,
                  status: agent.status,
                  currentTask: agentState.currentTask,
                  connections: Array.from(agentState.connections)
                }
              }));
            }
          });

          // Log general behavior
          const log = await db.insert(simulationLogs)
            .values({
              agentId: agent.id,
              type: 'behavior',
              message: `Agent ${agent.name} - ${currentBehavior} while pursuing: ${agent.goals}`,
            })
            .returning();

          this.broadcastLog(log[0]);
        } catch (error) {
          console.error(`[SimulationManager] Error processing agent ${agent.id}:`, error);
          // Log the error to simulation logs
          const errorLog = await db.insert(simulationLogs)
            .values({
              agentId: agent.id,
              type: 'error',
              message: `Error processing agent: ${error.message}`,
            })
            .returning();
          this.broadcastLog(errorLog[0]);
        }
      }
    } catch (error) {
      console.error('[SimulationManager] Error in simulation loop:', error);
      // Log the error to the simulation logs
      const errorLog = await db.insert(simulationLogs)
        .values({
          type: 'error',
          message: `Simulation error: ${error.message}`,
        })
        .returning();
      this.broadcastLog(errorLog[0]);
    }
  }, 2000);
    } catch (error) {
      console.error('[SimulationManager] Failed to start simulation:', error);
      throw error;
    }
  }

  private broadcastLog(log: Log) {
    console.log(`[SimulationManager] Broadcasting log: ${JSON.stringify(log)}`);
    
    // Format timestamp if not already formatted
    const formattedLog = {
      ...log,
      timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString()
    };

    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: 'log',
            payload: formattedLog
          }));
          console.log(`[SimulationManager] Log broadcast successful`);
        } catch (error) {
          console.error('[SimulationManager] Failed to broadcast log:', error);
        }
      }
    });
  }

  public async stop() {
    if (this.simulationStatus !== 'running') {
      console.log('[SimulationManager] Simulation is not running');
      return;
    }

    console.log('[SimulationManager] Stopping simulation');
    this.simulationStatus = 'paused';

    // Clear simulation interval
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    try {
      // Update all running agents to paused state
      await db.update(agents)
        .set({ status: 'paused' })
        .where(eq(agents.status, 'running'));

      // Clear all ongoing interactions and state
      this.agentStates.clear();
      
      // Log simulation pause
      const log = await db.insert(simulationLogs)
        .values({
          type: 'info',
          message: 'Simulation paused',
        })
        .returning();
      
      this.broadcastLog(log[0]);
      
      // Reset metrics
      this.metrics = {
        totalInteractions: 0,
        activeAgents: 0,
        goalCompletionRate: 0,
        averageProcessingTime: 0
      };
    } catch (error) {
      console.error('[SimulationManager] Error stopping simulation:', error);
      throw error;
    }
    
    // Broadcast updated status
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'status',
          payload: 'paused'
        }));
      }
    });
  }

  public async reset() {
    this.simulationStatus = 'idle';
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    // Clear all agent states and connections
    this.agentStates.clear();
    
    // Reset all agents to idle state and clear their memory
    await db.update(agents)
      .set({ 
        status: 'idle',
        memory: {},
        metadata: {}
      });
      
    // Reset metrics
    this.metrics = {
      totalInteractions: 0,
      activeAgents: 0,
      goalCompletionRate: 0,
      averageProcessingTime: 0
    };
    
    // Broadcast reset status and metrics
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'status',
          payload: 'idle'
        }));
        client.send(JSON.stringify({
          type: 'metrics',
          payload: this.metrics
        }));
      }
    });
  }
}
