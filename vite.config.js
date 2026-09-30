// SPDX-License-Identifier: GPL-3.0-or-later

import { version as reactVersion } from "react";
import { defineConfig, version as viteVersion } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import { resolve } from "path";

const juanVersion = "3.0.0";
const commitHash = (() => {
    try {
        return execSync("git rev-parse --short HEAD").toString().trim()
    } catch {
        return "unknown"
    }
})();

function generateManifestPlugin() {
    return {
        name: "generate-manifest",
        apply: "build",
        generateBundle() {
            const manifest = {
                manifest_version: 3,
                name: "联考水表机",
                // key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2pDuO9/P1XIsfylJ8TgMNw7oqpqLIXrCbQSFOfDhktTPAO2azAhEnElWbO+HQCStAkPDgPLxd9a2u51fDUYyqyySyD8RlcevnmwjoOxXFWJokEsIz7IUtOHfOfJdU3MLp2NQtM4dSnKfob+C9HRuKrkpDN4y2FM6u6GhpMQeBEg2ntzSLeet3al2k/mIddVmnQf4GPwNOlUfYFdlTiPRraR5jxTcSb2EcKBkwM9O0xTAmXO3WkvAaHUTATgjr50tBZzOAeT53DnlrYavrTD+msUFOrdIk7LcjSmrWch+I6fhZ5HufQinV3BFP5Xq7QeESy5E3LFko6DKwPGX0dGd4QIDAQAB",
                version: juanVersion,
                version_name: `${juanVersion} (${commitHash})`,
                description: "查查表",
                minimum_chrome_version: "109",
                permissions: [
                    "background",
                    "cookies",
                    "notifications",
                    "storage",
                    "tabs",
                    "webNavigation"
                ],
                host_permissions: [
                    "https://*.luogu.com.cn/*",
                    "https://www.luogu.me/*"
                ],
                // background: {
                //     "service_worker": "service-worker.js",
                //     "type": "module"
                // },
                icons: {
                    "16": "assets/icon.png",
                    "48": "assets/icon.png",
                    "128": "assets/icon.png"
                },
                action: { "default_popup": "popup.html" },
                content_scripts: [
                    // {
                    //     matches: [
                    //         "https://www.luogu.com.cn/*",
                    //         "https://www.luogu.com/*",
                    //         "https://www.luogu.me/*"
                    //     ],
                    //     js: ["content-wrapper.js"],
                    //     css: ["style.css"]
                    // },
                    // {
                    //     matches: [
                    //         "https://www.luogu.com.cn/*",
                    //         "https://www.luogu.com/*"
                    //     ],
                    //     js: ["hook.js"],
                    //     world: "MAIN",
                    //     run_at: "document_start",
                    // },
                    // {
                    //     matches: [
                    //         "https://www.luogu.com.cn/*",
                    //         "https://www.luogu.com/*"
                    //     ],
                    //     js: ["bridge.js"],
                    //     run_at: "document_start",
                    // }
                ],
                options_ui: {
                    "page": "management.html",
                    "open_in_tab": true
                },
                web_accessible_resources: [
                    {
                        "resources": [
                            "assets/*",
                            "content.js",
                            "hook.js"
                        ],
                        "matches": [
                            "<all_urls>"
                        ]
                    }
                ]
            }
            this.emitFile({
                type: "asset",
                fileName: "manifest.json",
                source: JSON.stringify(manifest)
            })
        }
    }
}

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
                popup: resolve(import.meta.dirname, "popup.html"),
                content: resolve(import.meta.dirname, "src/frontend/pages/content.jsx"),
                // "service-worker": resolve(import.meta.dirname, "src/service-worker.js"),
                // bridge: resolve(import.meta.dirname, "src/bridge.js"),
                // hook: resolve(import.meta.dirname, "src/hook.js"),
                management: resolve(import.meta.dirname, "management.html"),
                table: resolve(import.meta.dirname, "table.html"),
                filter: resolve(import.meta.dirname, "filter.html"),
                about: resolve(import.meta.dirname, "about.html"),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === "content") return "content.js";
                    return "assets/[hash].js";
                },
                chunkFileNames: "assets/[hash].js",
                assetFileNames: "assets/[hash][extname]",
            },
        },
    },
});