// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useLayoutEffect, useRef, useState, Children, cloneElement, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import styles from "./Generic.module.css";

/**
 * @param {number} p
 * @returns {string}
 */
export function percentToColor(p) {
    p = Math.max(0, Math.min(1, p));
    const stops = [
        // [0, 0xd8, 0x38, 0x41],
        // [0.3, 0xff, 0x57, 0x22],
        // [0.5, 0xff, 0xc1, 0x07],
        // [0.8, 0x8b, 0xc3, 0x4a],
        // [1, 0x4c, 0xaf, 0x50],
        [0, 0xd3, 0x2f, 0x2f],
        [0.2, 0xe6, 0x4a, 0x19],
        [0.4, 0xf5, 0x7c, 0x00],
        [0.6, 0xff, 0xa0, 0x00],
        [0.8, 0x7c, 0xb3, 0x42],
        [1, 0x38, 0x8e, 0x3c],
    ];
    let start = stops[0], end = stops[0];
    for (let i = 1; i < stops.length; ++i) {
        if (stops[i - 1][0] <= p && p <= stops[i][0]) {
            start = stops[i - 1];
            end = stops[i];
            break;
        }
    }
    const ratio = (p - start[0]) / (end[0] - start[0]);
    const r = start[1] * (1 - ratio) + end[1] * ratio;
    const g = start[2] * (1 - ratio) + end[2] * ratio;
    const b = start[3] * (1 - ratio) + end[3] * ratio;
    const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
export function percentToString(p, q) {
    if (p == 0) return "0%";
    else if (p == q) return "100%";
    return `${(p / q * 100).toFixed(0)}%`;
}

/** @param {string | null} [href] */
export function getPid(href = null) {
    const url = href ?? (new URL(location.href, "https://www.luogu.com.cn"));
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
    return null;
}
/** @param {string} pid */
export function getURL(pid) {
    if (pid.startsWith("P") || pid.startsWith("B") || pid.startsWith("CF") || pid.startsWith("AT_")) {
        return `https://www.luogu.com.cn/problem/${pid}`;
    }
    return null;
}

export function ShadowRoot({ children }) {
    const hostRef = useRef(null);
    const [root, setRoot] = useState(null);
    useEffect(() => {
        if (hostRef.current && !hostRef.current.shadowRoot) {
            setRoot(hostRef.current.attachShadow({ mode: "open" }));
        }
    }, []);
    return (
        <div ref={hostRef}>
            {root && createPortal(children, root)}
        </div>
    );
}

export function Anchor({ children, href, ...rest }) {
    let cls = styles.anchor;
    if (rest.className) {
        cls += " " + rest.className;
        delete rest.className;
    }
    return <a className={cls} href={href} target="_blank" {...rest}>{children}</a>
}
export function LightAnchor({ children, href, ...rest }) {
    let cls = `${styles.anchor} ${styles.light}`;
    if (rest.className) {
        cls += " " + rest.className;
        delete rest.className;
    }
    return <a className={cls} href={href} target="_blank" {...rest}>{children}</a>
}
export function Button({ children, onClick, confirm = null, ...rest }) {
    return <button
        className={styles.button}
        onClick={() => {
            if (confirm) {
                if (!window.confirm(confirm)) return;
            }
            onClick();
        }}
        {...rest}
    >{children}</button>
}
export function LineEdit({ onChange }) {
    return <input type="text" className={styles.lineedit} onChange={() => onChange()} />
}
/**
 * @param {Object} options
 * @param {[number, string][]} [options.items]
 * @param {[number,string]} [options.selected]
 * @param {any} [options.setSelected]
 */
export function ComboBox({ items, selected, setSelected }) {
    const onChange = useCallback((e) => {
        const val = items.find(item => item[0] === Number(e.target.value));
        if (val) setSelected(val);
    }, []);
    return (
        <select value={selected[0]} onChange={e => onChange(e)}>
            {items.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
            ))}
        </select>
    );
}

/**
 * @param {Object} options
 * @param {Account} options.account
 * @param {LuoguProfileNew} options.profile
 */
export function Username({ account, profile, ...rest }) {
    const uid = account.luogu;
    return (
        <span {...rest}>{profile.name ?? `uid:${uid}`}{account.star > 0 && "🌟"}</span>
    )
}
/**
 * @param {Object} options
 * @param {Account} options.account
 * @param {string} options.pid
 * @param {Origin} options.origin
 */
export function OriginAnchor({ children, account, pid, origin, ...rest }) {
    const [url, setUrl] = useState("");
    const uid = account.luogu;
    useEffect(() => {
        /** @type {[string, string | number]} */
        let ori;
        if (origin.passed.has(uid)) ori = origin.passed.get(uid);
        else if (origin.submitted.has(uid)) ori = origin.submitted.get(uid);
        if (!ori) return;
        const [src, handle] = ori;
        if (src == "lg") {
            setUrl(`https://www.luogu.com.cn/record/list?pid=${pid}&user=${handle}`);
        } else if (src == "cf") {
            if (!pid.startsWith("CF")) return;
            const cpid = pid.slice(2).match(/^\d+/);
            if (!cpid) return;
            setUrl(`https://codeforces.com/submissions/${handle}?contestId=${cpid[0]}`);
        } else if (src == "at") {
            if (!pid.startsWith("AT_")) return;
            const idx = pid.lastIndexOf("_");
            const cpid = pid.slice(3, idx).replaceAll("_", "-");
            const ppid = pid.slice(3);
            setUrl(`https://atcoder.jp/contests/${cpid}/submissions?f.Task=${ppid}&f.User=${handle}`);
        } else {
            setUrl(null);
        }
    }, [uid, pid, origin]);
    return <Anchor href={url || undefined} {...rest}>{children}</Anchor>
}

/**
 * 此组件要求只有一个子组件，且子组件可以接收 ref。
 */
export default function FadeAnimation({ children, visible, jumpin = false }) {
    const nodeRef = useRef(null);
    const timerRef = useRef(null);
    const oldDisplayRef = useRef("");
    const clearAnimation = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);
    const mergedRef = useCallback((node) => {
        nodeRef.current = node;
        const childRef = children.ref;
        if (typeof childRef === "function") {
            childRef(node);
        } else if (childRef && typeof childRef === "object") {
            childRef.current = node;
        }
    }, [children.ref]);
    useLayoutEffect(() => {
        /** @type {HTMLElement} */
        const node = nodeRef.current;
        if (!node) return;
        clearAnimation();
        if (visible) {
            node.style.display = oldDisplayRef.current;
            node.style.opacity = "0";
            if (jumpin) node.style.transform = "translateY(-5px)";
            // 强制回流
            void node.offsetHeight;
            requestAnimationFrame(() => {
                node.style.opacity = "1";
                if (jumpin) node.style.transform = "translateY(0)";
            });
        } else {
            node.style.opacity = "0";
            if (jumpin) node.style.transform = "translateY(-5px)";
            timerRef.current = setTimeout(() => {
                oldDisplayRef.current = node.style.display;
                node.style.display = "none";
                timerRef.current = null;
            }, 150);
        }
    }, [visible, jumpin, clearAnimation]);
    useEffect(() => {
        /** @type {HTMLElement} */
        const node = nodeRef.current;
        if (!node) return;
        oldDisplayRef.current = node.style.display;
        node.style.opacity = visible ? "1" : "0";
        // 强制回流，保证初始状态正确
        void node.offsetHeight;
        node.classList.add(styles.fade);
    }, []);
    return cloneElement(Children.only(children), { ref: mergedRef });
}

/**
 * @typedef {"top" | "bottom" | "left" | "right" | "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right" | "left-top" | "left-center" | "left-bottom" | "right-top" | "right-center" | "right-bottom"} Anchor
 * @param {Anchor} anchor
 * @param {DOMRect} rect
 * @param {number} width
 * @param {number} height
 * @param {number} [x=null]
 * @param {number} [y=null]
 * @param {number} [gap=5]
 */
export function getCoord(anchor, rect, width, height, x = null, y = null, gap = 5) {
    let top = y ? y - height / 2 : rect.top, left = x ? x - width / 2 : rect.left;
    if (anchor.startsWith("top")) top = rect.top - height - gap;
    else if (anchor.startsWith("bottom")) top = rect.bottom + gap;
    else if (anchor.startsWith("left")) left = rect.left - width - gap;
    else if (anchor.startsWith("right")) left = rect.right + gap;
    if (anchor.endsWith("-center")) {
        if (anchor == "top-center" || anchor == "bottom-center") left = rect.left + (rect.width - width) / 2;
        else top = rect.top + (rect.height - height) / 2;
    } else if (anchor.endsWith("-left")) left = rect.left;
    else if (anchor.endsWith("-right")) left = rect.right - width;
    else if (anchor.endsWith("-top")) top = rect.top;
    else if (anchor.endsWith("-bottom")) top = rect.bottom - height;
    return { top, left };
}
/**
 * @param {Anchor} anchor
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @param {number} minX
 * @param {number} minY
 * @param {number} maxX
 * @param {number} maxY
 */
export function clampCoord(anchor, left, top, width, height, minX, minY, maxX, maxY) {
    if (left < minX && anchor.startsWith("left")) return null;
    if (left + width > maxX && anchor.startsWith("right")) return null;
    left = Math.max(Math.min(left, maxX - width), minX);
    if (top < minY && anchor.startsWith("top")) return null;
    if (top + height > maxY && anchor.startsWith("bottom")) return null;
    top = Math.max(Math.min(top, maxY - height), minY);
    return { left, top };
}
/**
 * 注意：使用此组件时不应该手动传入 visible, targetRef 和 mouseStore 参数
 * @param {Object} options
 * @param {Anchor[]} [options.anchor]
 * @param {boolean} [options.strict]
 */
export function FloatDiv({ children, anchor = ["left"], strict = false, visible, targetRef, store, ...rest }) {
    const popupRef = useRef(null);
    const [top, setTop] = useState(0);
    const [left, setLeft] = useState(0);
    /** @type {{x: number | null, y: number | null}} */
    const { x: mouseX, y: mouseY } = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const rx = mouseX === null ? null : Math.floor(mouseX);
    const ry = mouseY === null ? null : Math.floor(mouseY);
    useLayoutEffect(() => {
        if (visible && targetRef.current && popupRef.current) {
            requestAnimationFrame(() => {
                /** @type {DOMRect} */
                const rect = targetRef.current.getBoundingClientRect();
                const width = popupRef.current.offsetWidth;
                const height = popupRef.current.offsetHeight;
                let ok = false;
                const test = (a) => {
                    if (!rx && !ry && !a.includes("-")) a += "-center";
                    const { top, left } = getCoord(a, rect, width, height, rx, ry);
                    let minX = 0, minY = 0, maxX = window.innerWidth, maxY = window.innerHeight;
                    if (strict) {
                        if (a.startsWith("left") || a.startsWith("right")) {
                            minY = rect.top;
                            maxY = rect.bottom;
                        } else {
                            minX = rect.left;
                            maxX = rect.right;
                        }
                    }
                    const coord = clampCoord(a, left, top, width, height, minX, minY, maxX, maxY);
                    if (coord) {
                        setTop(coord.top);
                        setLeft(coord.left);
                        ok = true;
                    }
                };
                for (const a of anchor) {
                    test(a);
                    if (ok) break;
                }
                if (!ok) {
                    for (const a of ["left", "right", "top", "bottom"]) {
                        test(a);
                        if (ok) break;
                    }
                    if (!ok) {
                        const a = anchor[0] ?? "left";
                        const { top, left } = getCoord(a, rect, width, height, rx, ry);
                        setTop(Math.max(Math.min(top, window.innerHeight - height), 0));
                        setLeft(Math.max(Math.min(left, window.innerWidth - width), 0));
                    }
                }
            });
        }
    }, [visible, targetRef, rx, ry]);
    return (
        <FadeAnimation visible={visible}>
            <div
                ref={popupRef}
                style={{
                    position: "fixed",
                    top: top,
                    left: left,
                    zIndex: 1000,
                }}
                className={styles.floatdiv}
                {...rest}
            >
                {children}
            </div>
        </FadeAnimation>
    );
}
/**
 * 注意：使用此组件时不应该手动传入 targetRef 参数
 */
export function FloatDivBinding({ children, targetRef, ...rest }) {
    return <div ref={targetRef} {...rest}>{children}</div>
}
function createMouseStore() {
    let snapshot = { x: 0, y: 0 };
    const hooks = new Set();
    return {
        subscribe(func) {
            hooks.add(func);
            return () => hooks.delete(func);
        },
        getSnapshot() { return snapshot; },
        update(x, y) {
            if (snapshot.x !== x || snapshot.y !== y) {
                snapshot = { x, y };
                hooks.forEach((func) => func());
            }
        },
    };
}
/**
 * 注意：steady 应当为定值
 */
export function FloatDivContainer({ children, holdFloat = true, steady = true }) {
    const [visible, setVisible] = useState(false);
    const targetRef = useRef(null);
    const isHoveringBinding = useRef(false);
    const isHoveringFloat = useRef(false);
    const hideTimerRef = useRef(null);
    const mouseRef = useRef(null);
    if (!mouseRef.current) {
        mouseRef.current = createMouseStore();
        if (steady) mouseRef.current.update(null, null);
    }
    const store = mouseRef.current;
    function clearHideTimer() {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };
    function tryHide() {
        if (!isHoveringBinding.current && !isHoveringFloat.current) {
            clearHideTimer();
            hideTimerRef.current = setTimeout(() => {
                setVisible(false);
                hideTimerRef.current = null;
            }, 100);
        }
    };
    useEffect(() => {
        return () => clearHideTimer();
    }, []);
    const processedChildren = Children.map(children, (child) => {
        if (child.type === FloatDivBinding) {
            return cloneElement(child, {
                targetRef,
                onMouseEnter: (e) => {
                    clearHideTimer();
                    isHoveringBinding.current = true;
                    if (!steady) store.update(e.clientX, e.clientY);
                    setVisible(true);
                    child.props.onMouseEnter?.(e);
                },
                onMouseMove: (e) => {
                    if (!steady) store.update(e.clientX, e.clientY);
                    child.props.onMouseMove?.(e);
                },
                onMouseLeave: (e) => {
                    isHoveringBinding.current = false;
                    tryHide();
                    child.props.onMouseLeave?.(e);
                },
            });
        } else if (child.type === FloatDiv) {
            return cloneElement(child, {
                visible,
                targetRef,
                store,
                onMouseEnter: (e) => {
                    if (holdFloat) {
                        clearHideTimer();
                        isHoveringFloat.current = true;
                        setVisible(true);
                    }
                    child.props.onMouseEnter?.(e);
                },
                onMouseLeave: (e) => {
                    if (holdFloat) {
                        isHoveringFloat.current = false;
                        tryHide();
                    }
                    child.props.onMouseLeave?.(e);
                },
            });
        }
        return child;
    });
    return <>{processedChildren}</>
}
