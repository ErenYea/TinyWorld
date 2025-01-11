import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import dotenv from 'dotenv';
dotenv.config();

// console.log(import.meta.env.VITE_DATABASE_URL);
// if (!import.meta.env.VITE_DATABASE_URL) {
//   throw new Error(
//     "DATABASE_URL must be set. Did you forget to provision a database?",
//   );
// }

export const db = drizzle({
  connection: process.env.VITE_DATABASE_URL!,
  schema,
  ws: ws,
});

