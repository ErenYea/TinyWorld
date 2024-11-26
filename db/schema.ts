import { pgTable, text, integer, json, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  goals: text("goals").notNull(),
  status: text("status").notNull().default('idle'),
  metadata: json("metadata").notNull().default({}),
  memory: json("memory").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const simulationLogs = pgTable("simulation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id),
  type: text("type").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const agentInteractions = pgTable("agent_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceAgentId: uuid("source_agent_id").references(() => agents.id),
  targetAgentId: uuid("target_agent_id").references(() => agents.id),
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  metadata: json("metadata").notNull().default({}),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agents);
export const selectAgentSchema = createSelectSchema(agents);
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = z.infer<typeof selectAgentSchema>;

export const insertLogSchema = createInsertSchema(simulationLogs);
export const selectLogSchema = createSelectSchema(simulationLogs);
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Log = z.infer<typeof selectLogSchema>;

export const insertInteractionSchema = createInsertSchema(agentInteractions);
export const selectInteractionSchema = createSelectSchema(agentInteractions);
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Interaction = z.infer<typeof selectInteractionSchema>;
