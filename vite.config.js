import { defineConfig } from "vite";

export default defineConfig({
    base: process.env.VITE_BASE_PATH || "/",
    build: {
        outDir: "dist",
        emptyOutDir: true,
        chunkSizeWarningLimit: 2050,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.endsWith("/src/data/restaurant-index.js")) {
                        return "restaurant-catalog";
                    }
                },
            },
        },
    },
});
