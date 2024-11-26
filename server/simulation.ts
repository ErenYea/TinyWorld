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
    this.startSimulationLoop();
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

  private async startSimulationLoop() {
    this.simulationInterval = setInterval(async () => {
      const runningAgents = await db.select()
        .from(agents)
        .where(eq(agents.status, 'running'));

      // Update active agents count
      this.updateMetrics(runningAgents.length);

      for (const agent of runningAgents) {
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
      }
    }, 2000);
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

  public stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
  }
}
