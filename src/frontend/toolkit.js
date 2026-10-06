// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * 把多个 ref 合并成一个 callback ref
 * @param {...React.Ref} refs
 * @note React 19
 * @example const mergedRef = useMemo(() => mergeRef(ref1, ref2, ref3), [ref1, ref2, ref3]);
 */
function mergeRef(...refs) {
    return (node) => {
        const cleanup = [];
        const manualFn = [];
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

export { mergeRef, mergeClassName };