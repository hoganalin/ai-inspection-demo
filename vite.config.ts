import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // 如果偵測到是在 Vercel 環境編譯，就使用 '/'（根路徑）
  // 否則（例如在本地編譯要傳到 GitHub Pages）就使用 '/ai-inspection-demo/'
  base: process.env.VERCEL ? "/" : "/ai-inspection-demo/",
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    allowedHosts: true,
  },
});
