import {defineConfig} from "vite";
import {svelte} from "@sveltejs/vite-plugin-svelte";
import {resolve} from "node:path";

//扩展有三个入口: 弹窗, 设置页, 后台 service worker(固定输出为 background.js, 由 manifest 引用)
export default defineConfig(({mode}) => ({
    root: resolve(import.meta.dirname, "src"),
    publicDir: resolve(import.meta.dirname, "public"),
    base: "",
    plugins: [svelte()],
    build: {
        outDir: resolve(import.meta.dirname, "dist"),
        emptyOutDir: true,
        target: "chrome120",
        minify: mode !== "development",
        sourcemap: mode === "development",
        modulePreload: false,
        rollupOptions: {
            input: {
                popup: resolve(import.meta.dirname, "src/popup/index.html"),
                options: resolve(import.meta.dirname, "src/options/index.html"),
                background: resolve(import.meta.dirname, "src/background.js"),
            },
            output: {
                entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash][extname]",
            },
        },
    },
}));
