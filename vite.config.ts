import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import checker from "vite-plugin-checker";
// import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// // Optionally, manually load .env variables if needed
import dotenv from "dotenv";
dotenv.config();


// const __dirname = path.dirname(new URL(import.meta.url).pathname);
// console.log("__dirname",__dirname);
const __dirname = path.resolve();
// console.log("__dirname",__dirname);

export default defineConfig({
  plugins: [
    react(),
    // checker({ typescript: true, overlay: false }),
    // runtimeErrorOverlay(),
    // themePlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@db": path.resolve(__dirname, "db"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  cacheDir: path.resolve(__dirname, "client/.vite_cache"),
  envPrefix: "VITE_",
  envDir: path.resolve(__dirname, "."),
  define: {
    "process.env": process.env,
  },
  
});