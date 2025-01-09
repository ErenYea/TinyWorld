import { defineConfig } from "drizzle-kit";

if (!process.env.VITE_DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.VITE_DATABASE_URL,
  },
});
