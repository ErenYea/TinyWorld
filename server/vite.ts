import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    appType: "custom",
  });
  console.log("Create Vite Server");
  app.use(vite.middlewares);
  console.log("Use Vite Middlewares");
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    console.log("Use Vite Middlewares");
    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html"
      );
      console.log("Read Client Template");
      // always reload the index.html file from disk incase it changes
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      console.log("Transform Index HTML");
      const page = await vite.transformIndexHtml(url, template);
      console.log("Send Index HTML");
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      console.log("Error",e);
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  console.log("Serve Static");

  if (!fs.existsSync(distPath)) {
    console.log("Could not find the build directory");
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));
  console.log("Serve Static");
  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    console.log("Send Static File");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
