import { db } from "../db";
import { agents, simulationLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocket, WebSocketServer } from "ws";
import type { Log } from "@db/schema";

export class SimulationManager {
  private wss: WebSocketServer;
  private simulationInterval: NodeJS.Timeout | null = null;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.startSimulationLoop();
  }

  private async startSimulationLoop() {
    this.simulationInterval = setInterval(async () => {
      const runningAgents = await db.select()
        .from(agents)
        .where(eq(agents.status, 'running'));

      for (const agent of runningAgents) {
        // Simulate agent behavior
        const log = await db.insert(simulationLogs)
          .values({
            agentId: agent.id,
            type: 'info',
            message: `Agent ${agent.name} is processing its goals: ${agent.goals}`,
          })
          .returning();

        this.broadcastLog(log[0]);
      }
    }, 2000);
  }

  private broadcastLog(log: Log) {
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'log',
          payload: log
        }));
      }
    });
  }

  public stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
  }
}
