import { db } from "../db";
import { agents, simulationLogs, agentInteractions } from "@db/schema";
import { eq, and, or } from "drizzle-orm";
import { WebSocket, WebSocketServer } from "ws";
import type { Log, Agent } from "@db/schema";
import { ClaudeService } from "./services/claude";
import { json } from "drizzle-orm/pg-core";

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
interface CustomWebSocket extends WebSocket {
  isAlive: boolean;
  userId: string;
}
type BehaviorPattern = 'ANALYZE' | 'COLLABORATE' | 'OPTIMIZE' | 'LEARN';

export class SimulationManager {
  private wss: WebSocket;
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
  private userId: string;

  constructor(wss: WebSocket,userId:string, context: WorldContext = {
    name: "Default World",
    description: "A simulation environment for AI agents to interact and evolve",
    rules: ["Agents must collaborate to achieve goals", "Agents should respect resource constraints"],
    state: { timestamp: new Date().toISOString() }
  }) {
    this.wss = wss;
    this.userId = userId;
    this.worldContext = context;
  }

  public updateWorldState(updates: Partial<Record<string, any>>) {
    this.worldContext.state = {
      ...this.worldContext.state,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    this.broadcastToAll({
      type: 'worldState',
      payload: this.worldContext
    },);
  }

  private broadcastToAll(data: any) {
    // console.log('Broadcast to all',this.wss.clients);
    this.wss.send(JSON.stringify(data));
    // console.log('Broadcast to all',data);

  }

  private determineInteraction(agent1Goals: string, agent2Goals: string): boolean {
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

  private async processAgentBehavior(agent: Agent, pattern: BehaviorPattern): Promise<string> {
    // Immediate status check with logging
    if (this.simulationStatus !== 'running') {
      console.log('[SimulationManager] Skipping behavior processing - simulation status:', this.simulationStatus);
      return '';
    }
    
    // Synchronize state check
    await new Promise(resolve => setTimeout(resolve, 0));
    if (this.simulationStatus !== 'running') {
      return '';
    }
    
    const claudeService = ClaudeService.getInstance();
    try {
      const currentMemory = agent.memory as Record<string, any>;
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
        .where(and(eq(agents.id, agent.id),eq(agents.userId,this.userId)));

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SimulationManager] Error processing agent behavior:', errorMessage);
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
    this.broadcastToAll({
      type: 'metrics',
      payload: this.metrics
    });
  }

  private async updateAgentStatus(agentId: string, newStatus: 'idle' | 'running' | 'paused') {
    try {
      await db.update(agents)
        .set({ status: newStatus })
        .where(and(eq(agents.id, agentId),eq(agents.userId,this.userId)));

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SimulationManager] Failed to update agent status: ${errorMessage}`);
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

      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }

      this.simulationStatus = 'running';
      
      const idleAgents = await db.select()
        .from(agents)
        .where(and(eq(agents.status, 'idle'),eq(agents.userId,this.userId)));
      
      for (const agent of idleAgents) {
        await this.updateAgentStatus(agent.id, 'running');
      }

      this.simulationInterval = setInterval(async () => {
        // Immediate status check
        if (this.simulationStatus !== 'running') {
          console.log('[SimulationManager] Skipping loop - simulation status:', this.simulationStatus);
          return;
        }
        
        try {
          // Double-check status hasn't changed
          if (this.simulationStatus !== 'running') {
            return;
          }

          const runningAgents = await db.select()
            .from(agents)
            .where(and(eq(agents.status, 'running'),eq(agents.userId,this.userId)));

          console.log(`[SimulationManager] Processing ${runningAgents.length} running agents`);

          this.updateMetrics(runningAgents.length);

          for (const agent of runningAgents) {
            try {
              const startTime = Date.now();
              
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
              const currentBehavior = await this.processAgentBehavior(agent as Agent, pattern);
              
              for (const otherAgent of runningAgents) {
                if (agent.id !== otherAgent.id && 
                    this.determineInteraction(agent.goals, otherAgent.goals)) {
                  
                  const agentState = this.agentStates.get(agent.id)!;
                  agentState.connections.add(otherAgent.id);
                  agentState.interactionCount++;
                  this.metrics.totalInteractions++;

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

              const agentState = this.agentStates.get(agent.id)!;
              agentState.currentTask = currentBehavior;
              agentState.processingTime = Date.now() - startTime;

              const currentAgent = await db.select()
                .from(agents)
                .where(and(eq(agents.id, agent.id),eq(agents.userId,this.userId)))
                .limit(1);

              if (!currentAgent[0] || currentAgent[0].status !== 'running') {
                console.log(`[SimulationManager] Agent ${agent.id} is no longer running, skipping updates`);
                continue;
              }

              this.broadcastToAll({
                type: 'agentState',
                payload: {
                  id: agent.id,
                  name: agent.name,
                  status: agent.status,
                  currentTask: agentState.currentTask,
                  connections: Array.from(agentState.connections)
                }
              });

              const log = await db.insert(simulationLogs)
                .values({
                  agentId: agent.id,
                  type: 'behavior',
                  message: `Agent ${agent.name} - ${currentBehavior} while pursuing: ${agent.goals}`,
                })
                .returning();

              this.broadcastLog(log[0]);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`[SimulationManager] Error processing agent ${agent.id}:`, errorMessage);
              
              const errorLog = await db.insert(simulationLogs)
                .values({
                  agentId: agent.id,
                  type: 'error',
                  message: `Error processing agent: ${errorMessage}`,
                })
                .returning();
              
              this.broadcastLog(errorLog[0]);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[SimulationManager] Error in simulation loop:', errorMessage);
          
          const errorLog = await db.insert(simulationLogs)
            .values({
              type: 'error',
              message: `Simulation error: ${errorMessage}`,
            })
            .returning();
          
          this.broadcastLog(errorLog[0]);
        }
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SimulationManager] Failed to start simulation:', errorMessage);
      throw error;
    }
  }

  private broadcastLog(log: Log,) {
    console.log(`[SimulationManager] Broadcasting log: ${JSON.stringify(log)}`);
    
    const formattedLog = {
      ...log,
      timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString()
    };

    this.broadcastToAll({
      type: 'log',
      payload: formattedLog
    });
  }

  public async stop() {
    console.log('[SimulationManager] Stopping simulation');
    
    // Set status first to prevent new interactions
    this.simulationStatus = 'paused';
    
    // Clear interval immediately
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    try {
      // Force clear all ongoing processes
      this.agentStates.clear();
      
      // Update all running agents to paused state
      await db.update(agents)
        .set({ status: 'paused' })
        .where(and(eq(agents.status, 'running'),eq(agents.userId,this.userId)));
        
      // Reset active metrics
      this.metrics.activeAgents = 0;
      this.updateMetrics(0);
      
      // Broadcast status update
      this.broadcastToAll({
        type: 'status',
        payload: 'paused'
      });
      
      const log = await db.insert(simulationLogs)
        .values({
          type: 'info',
          message: 'Simulation paused - all agents stopped'
        })
        .returning();
      
      this.broadcastLog(log[0]);
      
    } catch (error) {
      console.error('[SimulationManager] Error stopping simulation:', error);
      throw error;
    }
  }

  public async reset() {
    // First stop any running simulation
    if (this.simulationStatus === 'running') {
      await this.stop();
    }
    
    this.simulationStatus = 'idle';
    
    try {
      // Clear all states and intervals
      this.agentStates.clear();
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }

      // Reset all agents to idle state
      await db.update(agents)
        .set({ 
          status: 'idle',
          memory: {} // Clear agent memory
        })
        .where(and(
          or(
            eq(agents.status, 'running'),
            eq(agents.status, 'paused')
          ),
          eq(agents.userId,this.userId)
        ));

      // Reset metrics
      this.metrics = {
        totalInteractions: 0,
        activeAgents: 0,
        goalCompletionRate: 0,
        averageProcessingTime: 0
      };

      // Broadcast reset state
      this.broadcastToAll({
        type: 'status',
        payload: 'idle'
      });
      
      this.broadcastMetrics();

      const log = await db.insert(simulationLogs)
        .values({
          type: 'info',
          message: 'Simulation fully reset - all agents and states cleared'
        })
        .returning();
      
      this.broadcastLog(log[0]);

    } catch (error) {
      console.error('[SimulationManager] Error resetting simulation:', error);
      throw error;
    }
  }

  public async exportAgentData(agentId: string): Promise<{
    agent: Agent;
    interactions: any[];
    logs: Log[];
  }> {
    try {
      const [agent] = await db.select()
        .from(agents)
        .where(and(eq(agents.id, agentId),eq(agents.userId,this.userId)))
        .limit(1);

      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }

      const interactions = await db.select()
        .from(agentInteractions)
        .where(
          or(
            eq(agentInteractions.sourceAgentId, agentId),
            eq(agentInteractions.targetAgentId, agentId)
          )
        );

      const logs = await db.select()
        .from(simulationLogs)
        .where(eq(simulationLogs.agentId, agentId));

      return {
        agent: agent as Agent,
        interactions,
        logs
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SimulationManager] Error exporting agent data:', errorMessage);
      throw error;
    }
  }

  public async terminateAgent(agentId: string) {
    try {
      // Update agent status to idle
      await db.update(agents)
        .set({ status: 'idle', memory: {} as JSON })
        .where(and(eq(agents.id, agentId),eq(agents.userId,this.userId)));

      // Remove from active states
      this.agentStates.delete(agentId);

      // Log termination
      const log = await db.insert(simulationLogs)
        .values({
          agentId,
          type: 'info',
          message: 'Agent terminated and reset to idle state'
        })
        .returning();

      this.broadcastLog(log[0]);

      // Update metrics
      this.updateMetrics(this.agentStates.size);

      // Broadcast updated agent list
      const updatedAgents = await db.select().from(agents).where(eq(agents.userId,this.userId));
      this.broadcastToAll({
        type: 'agents',
        payload: updatedAgents
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SimulationManager] Error terminating agent:', errorMessage);
      throw error;
    }
  }
}