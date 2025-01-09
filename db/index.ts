import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

// console.log(import.meta.env.VITE_DATABASE_URL);
// if (!import.meta.env.VITE_DATABASE_URL) {
//   throw new Error(
//     "DATABASE_URL must be set. Did you forget to provision a database?",
//   );
// }

export const db = drizzle({
  connection: 'postgresql://neondb_owner:N7FslJ2goZQT@ep-sweet-term-a658h3gr.us-west-2.aws.neon.tech/neondb?sslmode=require',
  schema,
  ws: ws,
});
