// SPDX-License-Identifier: GPL-3.0-or-later

import { version as reactVersion } from "react";
import { defineConfig, version as viteVersion } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { generateManifestPlugin } from "./plugins/manifest.js";
import { commitHash, juanVersion } from "./plugins/meta.js";

export default defineConfig({
    plugins: [
        react(),
        generateManifestPlugin(),
    ],
    root: ".",
    base: "",
    define: {
        __REACT_VERSION__: JSON.stringify(reactVersion),
        __VITE_VERSION__: JSON.stringify(viteVersion),
        __JUAN_VERSION__: JSON.stringify(juanVersion),
        __COMMIT_HASH__: JSON.stringify(commitHash),
    },
    build: {
        outDir: "./dist",
        emptyOutDir: true,
        modulePreload: false,
        rollupOptions: {
            input: {
                popup: resolve(import.meta.dirname, "entries/popup.html"),
                content: resolve(import.meta.dirname, "src/frontend/pages/content.jsx"),
                "service-worker": resolve(import.meta.dirname, "src/backend/service-worker.js"),
                // bridge: resolve(import.meta.dirname, "src/bridge.js"),
                // hook: resolve(import.meta.dirname, "src/hook.js"),
                management: resolve(import.meta.dirname, "entries/management.html"),
                table: resolve(import.meta.dirname, "entries/table.html"),
                filter: resolve(import.meta.dirname, "entries/filter.html"),
                about: resolve(import.meta.dirname, "entries/about.html"),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === "content") return "content.js";
                    if (chunkInfo.name === "service-worker") return "service-worker.js";
                    return "assets/[hash].js";
                },
                chunkFileNames: "assets/[hash].js",
                assetFileNames: "assets/[hash][extname]",
            },
        },
    },
});