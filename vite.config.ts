import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API server (server/index.ts) runs on 3001 in development; Vite proxies API and upload URLs to it.
// In Docker, use the service name 'api' instead of localhost.
const apiTarget = process.env.VITE_API_TARGET || "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": apiTarget,
      "/uploads": apiTarget,
    },
  },
});
