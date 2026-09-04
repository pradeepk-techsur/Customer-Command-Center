import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API server (server/index.ts) runs on 3001 in development; Vite proxies API and upload URLs to it.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
    },
  },
});
