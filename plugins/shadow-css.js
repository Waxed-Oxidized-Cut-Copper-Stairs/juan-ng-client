// SPDX-License-Identifier: GPL-3.0-or-later
// Note: AI-generated (DeepSeek V4.1); human-reviewed and modified.

import { Buffer } from "node:buffer"

const VIRTUAL_ID = "virtual:shadow-css"
const RESOLVED_ID = "\0" + VIRTUAL_ID
const PLACEHOLDER = "__VITE_SHADOW_CSS_PLACEHOLDER__"

export default function shadowCssPlugin() {
    return {
        name: "shadow-css",
        apply: "build",
        enforce: "post",
        resolveId(id) {
            if (id === VIRTUAL_ID) return RESOLVED_ID;
        },
        load(id) {
            if (id !== RESOLVED_ID) return;
            return `export default ${JSON.stringify(PLACEHOLDER)}`;
        },
        generateBundle(_options, bundle) {
            // 1. 收集所有 CSS asset 的文本
            const cssAssetText = new Map();
            for (const [fileName, item] of Object.entries(bundle)) {
                if (item.type === "asset" && fileName.endsWith(".css")) {
                    const src = item.source;
                    cssAssetText.set(
                        fileName,
                        typeof src === "string" ? src : Buffer.from(src).toString("utf-8"),
                    );
                }
            }
            // 2. 递归收集该 chunk 及其所有依赖 chunk 的 importedCss
            const collectCssFiles = (chunk, visited = new Set()) => {
                if (visited.has(chunk.fileName)) return [];
                visited.add(chunk.fileName);
                const files = [];
                // 先依赖，后自己 —— 保证层叠顺序：被依赖的在前
                for (const dep of chunk.imports ?? []) {
                    const depChunk = bundle[dep];
                    if (depChunk && depChunk.type === "chunk") {
                        files.push(...collectCssFiles(depChunk, visited));
                    }
                }
                if (chunk.viteMetadata?.importedCss) {
                    for (const f of chunk.viteMetadata.importedCss) {
                        if (!files.includes(f)) files.push(f);
                    }
                }
                return files;
            }
            // 3. 替换占位符
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== "chunk") continue;
                if (!chunk.code.includes(PLACEHOLDER)) continue;
                const cssFiles = collectCssFiles(chunk);
                const cssText = cssFiles
                    .map((f) => cssAssetText.get(f) ?? "")
                    .filter(Boolean)
                    .join("\n");
                console.log(`[shadow-css] ${chunk.fileName}: ${cssFiles.length} css file(s), ${cssText.length} chars`);
                // 压缩器可能把占位符变成 " / " / ` 包裹，用正则兜住
                const re = new RegExp(`([""\`])${PLACEHOLDER}\\1`, "g");
                chunk.code = chunk.code.replace(re, () => JSON.stringify(cssText));
                // 改过 code，sourcemap 会错位
                chunk.map = null;
            }
        },
    }
}