// SPDX-License-Identifier: GPL-3.0-or-later

import { error } from "../shared/core";

/**
 * 把多个 ref 合并成一个 callback ref
 * @param {...React.Ref<any>} refs
 * @note React 19
 * @example const mergedRef = useMemo(() => mergeRef(ref1, ref2, ref3), [ref1, ref2, ref3]);
 */
function mergeRef(...refs) {
    return (/** @type {any} */ node) => {
        /** @type {(() => void)[]} */
        const cleanup = [];
        /** @type {((node: any) => void)[]} */
        const manualFn = [];
        /** @type {React.RefObject<any>[]} */
        const manualRef = [];
        for (const ref of refs) {
            if (typeof ref === "function") {
                const fn = ref(node);
                if (typeof fn === "function") {
                    cleanup.push(fn);
                } else {
                    manualFn.push(ref);
                }
            } else if (ref) {
                ref.current = node;
                manualRef.push(ref);
            }
        }
        return () => {
            for (const fn of cleanup) fn();
            for (const fn of manualFn) fn(null);
            for (const ref of manualRef) ref.current = null;
        }
    };
}

/**
 * 合并 className
 * @param  {...string} classNames
 */
function mergeClassName(...classNames) {
    return classNames.filter(Boolean).join(" ");
}

/**
 * 从洛谷链接解析题目 PID
 * @param {string | null} [href=null]
 * @returns {PID}
 */
export function getPid(href = null) {
    try {
        const url = new URL(href ?? location.href, "https://www.luogu.com.cn");
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        if (url.hostname === "www.luogu.com.cn") {
            if (url.pathname.startsWith("/problem/")) {
                const urls = url.pathname.split("/").filter(Boolean);
                const pid = urls.at(-1);
                if (urls.at(-2) !== "problem" || pid === "list" || pid === "random" || pid === "new" || pid === undefined) return null;
                return pid;
            }
        }
        if (url.hostname === "www.luogu.org") {
            if (url.pathname.startsWith("/problemnew/show/")) {
                return url.pathname.split("/").filter(Boolean).at(-1);
            }
        }
    } catch (e) {
        error("getPid", e);
    }
    return null;
}

export { mergeRef, mergeClassName };