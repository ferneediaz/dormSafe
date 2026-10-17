import tailwindcss from "@tailwindcss/vite";
import { tanstackBuildConfig } from "@tanstack/react-start/config";
import viteReact from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackBuildConfig(),
    viteReact(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/external": {
        target: process.env.VITE_DORMSAFE_API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
