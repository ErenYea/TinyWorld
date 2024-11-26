import { db } from "../db";
import { agents, simulationLogs, agentInteractions } from "@db/schema";
import { eq, and, or } from "drizzle-orm";
import { WebSocket, WebSocketServer } from "ws";
import type { Log, Agent } from "@db/schema";
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
    this.broadcastToAll({
      type: 'worldState',
      payload: this.worldContext
    });
  }

  private broadcastToAll(data: any) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(data));
        } catch (error) {
          console.error('Failed to broadcast to client:', error);
        }
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

  private async processAgentBehavior(agent: Agent, pattern: BehaviorPattern): Promise<string> {
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
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`[SimulationManager] Error processing agent ${agent.id}:`, errorMessage);
              
              // Log the error to simulation logs
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
          
          // Log the error to the simulation logs
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

  private broadcastLog(log: Log) {
    console.log(`[SimulationManager] Broadcasting log: ${JSON.stringify(log)}`);
    
    // Format timestamp if not already formatted
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

      // Broadcast updated status
      this.broadcastToAll({
        type: 'status',
        payload: 'paused'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SimulationManager] Error stopping simulation:', errorMessage);
      throw error;
    }
  }

  public async exportAgentData(agentId: string) {
    try {
      // Type safe validation
      if (!agentId || typeof agentId !== 'string') {
        throw new Error('Invalid agent ID provided');
      }

      // Get agent data with type safety
      const [agent] = await db.select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        goals: agents.goals,
        status: agents.status,
        metadata: agents.metadata,
        memory: agents.memory,
        createdAt: agents.createdAt
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }

      // Get agent interactions with specified fields
      const interactions = await db.select({
        id: agentInteractions.id,
        sourceAgentId: agentInteractions.sourceAgentId,
        targetAgentId: agentInteractions.targetAgentId,
        prompt: agentInteractions.prompt,
        response: agentInteractions.response,
        metadata: agentInteractions.metadata,
        timestamp: agentInteractions.timestamp
      })
      .from(agentInteractions)
      .where(
        or([
          eq(agentInteractions.sourceAgentId, agentId),
          eq(agentInteractions.targetAgentId, agentId)
        ])
      )
      .orderBy(agentInteractions.timestamp);

      // Get agent logs with specified fields
      const logs = await db.select({
        id: simulationLogs.id,
        type: simulationLogs.type,
        message: simulationLogs.message,
        timestamp: simulationLogs.timestamp
      })
      .from(simulationLogs)
      .where(eq(simulationLogs.agentId, agentId))
      .orderBy(simulationLogs.timestamp);

      const exportData = {
        agent,
        interactions,
        logs,
        stats: {
          totalInteractions: interactions.length,
          totalLogs: logs.length,
          exportTime: new Date().toISOString()
        }
      };

      // Log successful export
      await db.insert(simulationLogs)
        .values({
          agentId,
          type: 'info',
          message: `Successfully exported data for agent: ${agent.name}`
        });

      // Broadcast export data
      this.broadcastToAll({
        type: 'agentExport',
        payload: exportData
      });

      return exportData;
    } catch (error) {
      // Enhanced error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SimulationManager] Error exporting agent data:', {
        agentId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Log export error
      await db.insert(simulationLogs)
        .values({
          agentId,
          type: 'error',
          message: `Failed to export agent data: ${errorMessage}`
        });

      throw new Error(`Failed to export agent data: ${errorMessage}`);
    }
  }

  public async analyzeDiscussion(query: string): Promise<any> {
    try {
      // Get relevant logs
      const logs = await db.select()
        .from(simulationLogs)
        .where(
          and([
            eq(simulationLogs.type, 'interaction')
            // Add more specific conditions based on query
          ])
        );

      // Use Claude to analyze the logs
      const claudeService = ClaudeService.getInstance();
      const analysisPrompt = `
        Analyze the following conversation logs and ${query}:
        ${logs.map(log => `${log.timestamp}: ${log.message}`).join('\n')}
      `;

      const analysisAgent: Agent = {
        id: 'analysis-agent',
        name: 'LogAnalyzer',
        description: 'Analysis agent',
        goals: query,
        status: 'idle',
        metadata: {},
        memory: {},
        createdAt: new Date()
      };

      const { response } = await claudeService.generateResponse(
        analysisAgent,
        analysisPrompt,
        {}
      );

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SimulationManager] Error analyzing discussion:', errorMessage);
      throw error;
    }
  }

  public async terminateAgent(agentId: string) {
    try {
      // Update agent status to idle and clear memory
      await db.update(agents)
        .set({ 
          status: 'idle',
          memory: {},
          metadata: {}
        })
        .where(eq(agents.id, agentId));

      // Get current agent state
      const currentState = this.agentStates.get(agentId);
      
      if (currentState) {
        // Remove connections to this agent from other agents
        for (const [otherAgentId, state] of this.agentStates.entries()) {
          if (state.connections.has(agentId)) {
            state.connections.delete(agentId);
          }
        }
        // Remove from active states
        this.agentStates.delete(agentId);
      }

      // Log termination
      const log = await db.insert(simulationLogs)
        .values({
          agentId,
          type: 'info',
          message: 'Agent terminated',
        })
        .returning();

      this.broadcastLog(log[0]);

      // Update metrics
      this.updateMetrics(this.agentStates.size);

      // Broadcast updated agent list
      const updatedAgents = await db.select().from(agents);
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
