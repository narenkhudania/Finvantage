import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const explicitProxyTarget = (env.VITE_API_PROXY_TARGET || "").trim();
  // Keep API proxy enabled for any non-production local mode (development, local, staging-local, etc.).
  const implicitProxyTarget =
    mode !== "production"
      ? ((env.VITE_API_BASE_URL || "http://localhost:3001").trim())
      : "";
  const proxyTarget = explicitProxyTarget || implicitProxyTarget;

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: proxyTarget
        ? {
            "/api": {
              target: proxyTarget,
              changeOrigin: true,
              // Local Vercel dev backend runs on plain HTTP.
              secure: false,
            },
          }
        : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("@supabase/supabase-js")) return "vendor-supabase";
            return "vendor";
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
