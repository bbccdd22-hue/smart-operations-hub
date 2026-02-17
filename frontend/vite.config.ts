import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = env.VITE_API_BASE;
  const target =
    apiBase && apiBase.startsWith("http")
      ? apiBase.replace(/\/api\/?$/, "")
      : "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
      },
    },
    build: {
      minify: true,
      cssMinify: true,
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name]-[hash][extname]",
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
        },
      },
    },
  };
});

