// SPDX-License-Identifier: GPL-3.0-or-later

/** @type {Group[]}} */
const users = await chrome.runtime.sendMessage({ dst: "sw", type: "query-users" });

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import FadeAnimation, { Button, ComboBox, getPid, ShadowRoot } from "./components/Generic.jsx";
import { GroupView } from "./components/GroupView.jsx";
import { flushCache, subscribe } from "./protocol_v2.js";
import styles from "./content.module.scss";
import cssText1 from "./content.module.scss?inline";
import cssText2 from "./components/Generic.module.css?inline";
import cssText3 from "./components/GroupView.module.css?inline";
import cssText4 from "./components/StatusBar.module.css?inline";
import cssText5 from "./components/TableView.module.css?inline";
import TableView from "./components/TableView.jsx";

const cssText = cssText1 + cssText2 + cssText3 + cssText4 + cssText5;

function StyleSheetLoader() {
    const containerRef = useRef(null);
    useEffect(() => {
        const node = document.createElement("style");
        node.textContent = cssText;
        containerRef.current.appendChild(node);
        return () => {
            node.remove();
        };
    }, []);
    return <div ref={containerRef}></div>;
}

function DropBox() {
    const [pid, setPid] = useState(null);
    const [visible, setVisible] = useState(false);
    const dropboxRef = useRef(null);
    const currentRef = useRef(null);
    const showTimerRef = useRef(null);
    const hideTimerRef = useRef(null);
    const clearShowTimer = useCallback(() => {
        console.log("clearShowTimer");
        if (showTimerRef.current) {
            clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }
    }, []);
    const clearHideTimer = useCallback(() => {
        console.log("clearHideTimer");
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);
    const hideDropboxImmediately = useCallback(() => {
        if (!visible) return;
        console.log("hideDropboxImme");
        // clearShowTimer();
        clearHideTimer();
        setVisible(false);
        currentRef.current = null;
    }, [visible, clearShowTimer, clearHideTimer]);
    const showDropboxImmediately = useCallback((newPid) => {
        if (visible) return;
        console.log("showDropboxImme", newPid);
        clearShowTimer();
        clearHideTimer();
        setVisible(true);
        setPid(newPid);
    }, [visible, clearShowTimer, clearHideTimer]);
    const hideDropbox = useCallback(() => {
        console.log("hideDropbox");
        clearShowTimer();
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => {
            hideDropboxImmediately();
            hideTimerRef.current = null;
        }, 150);
    }, [clearShowTimer, clearHideTimer, hideDropboxImmediately]);
    const showDropbox = useCallback((node, newPid) => {
        console.log("showDropbox", newPid);
        if (visible && currentRef.current !== node) {
            hideDropboxImmediately();
        }
        currentRef.current = node;
        clearShowTimer();
        clearHideTimer();
        showTimerRef.current = setTimeout(() => {
            showDropboxImmediately(newPid);
            showTimerRef.current = null;
        }, 150);
    }, [visible, showDropboxImmediately, hideDropboxImmediately, clearShowTimer]);
    /** @param {HTMLAnchorElement} node */
    function handleNode(node, signal) {
        if (node.hasAttribute("juan-watching")) return;
        node.setAttribute("juan-watching", "");
        node.addEventListener("mouseenter", () => {
            if (!node.href) return;
            const newPid = getPid(new URL(node.href));
            if (newPid && (!newPid.startsWith("U") || newPid.startsWith("UVA")) && !newPid.startsWith("T")) {
                showDropbox(node, newPid);
            }
        }, { signal });
        node.addEventListener("mouseleave", () => {
            if (currentRef.current === node) hideDropbox();
        }, { signal });
        return () => {
            node.removeAttribute("juan-watching");
        };
    }
    useEffect(() => {
        const abort = new AbortController();
        document.addEventListener("visibilitychange", hideDropboxImmediately, { signal: abort.signal });
        let unloads = [];
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeName === "A") {
                        const fn = handleNode(node, abort.signal);
                        if (fn) unloads.push(fn);
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        node.querySelectorAll("a")
                            .forEach((child) => {
                                const fn = handleNode(child, abort.signal);
                                if (fn) unloads.push(fn);
                            });
                    }
                }
            }
        });
        const app = document.getElementById("app") ?? document.documentElement;
        observer.observe(app, { subtree: true, childList: true });
        app.querySelectorAll("a").forEach((node) => {
            const fn = handleNode(node, abort.signal);
            if (fn) unloads.push(fn);
        });
        return () => {
            abort.abort();
            observer.disconnect();
            for (const fn of unloads) fn();
        };
    }, [showDropbox, hideDropbox, hideDropboxImmediately]);
    useLayoutEffect(() => {
        if (!visible || !dropboxRef.current || !currentRef.current) return;
        const node = currentRef.current;
        const url = new URL(location.href);
        const type = url.pathname.match("/user/\\d+/practice")
            ? "practice"
            : url.pathname.match("/article/[a-z0-9]+")
                ? "article"
                : url.pathname.startsWith("/problem/list")
                    ? "problem-list"
                    : null;
        const rect = node.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        const spaceTop = rect.top;
        /** @type {HTMLElement} */
        const box = dropboxRef.current;
        let trY = "-37%";
        let top, left;
        if (spaceRight < 200) {
            trY = "0px";
            top = rect.bottom + 5;
            left = rect.left;
        } else {
            if (spaceTop <= 120) {
                trY = `-${Math.min(spaceTop - 10, 100)}px`;
            }
            top = (rect.top + rect.bottom) / 2;
            left = rect.right + 5;
            if (type === "practice" || type === "article") {
                const contentNode =
                    type === "practice"
                        ? document.querySelector("div.sidebar-container.reverse div.main")
                        : document.querySelector(
                            "div.article-content.columba-content-wrap.wrapper div.lfe-marked-wrap"
                        );
                if (contentNode) {
                    const rec = contentNode.getBoundingClientRect();
                    const right = rec.left + contentNode.clientWidth;
                    if (right + 400 < window.innerWidth) {
                        left = right + 10;
                    }
                }
            }
        }
        console.log(top, left);
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
        box.style.transform = `translateY(${trY})`;
    }, [visible]);
    return (
        <ShadowRoot>
            <StyleSheetLoader />
            <FadeAnimation visible={visible} jumpin={true}>
                <div
                    ref={dropboxRef}
                    className={styles.xroot}
                    style={{
                        position: "fixed",
                        zIndex: 1000,
                    }}
                >
                    <div
                        className={styles.xdropbox}
                        onMouseEnter={() => clearHideTimer()}
                        onMouseLeave={() => hideDropbox()}
                    >
                        <GroupView groups={users} pid={pid}>
                            <h3 className={styles.xh3}>{pid} 的通过情况</h3>
                        </GroupView>
                    </div>
                </div>
            </FadeAnimation>
        </ShadowRoot>
    );
}

function Card({ pid }) {
    return (
        <ShadowRoot>
            <StyleSheetLoader />
            <div className={styles.xroot}>
                <div className={styles.xcard}>
                    <GroupView groups={users} pid={pid} verbose={true}>
                        <h3 className={styles.xh3}>卷王</h3>
                    </GroupView>
                    <div>
                        <p className={styles.tip}>统计数据非实时更新</p>
                        <Button onClick={() => { flushCache(); }}>刷新缓存</Button>
                    </div>
                </div>
            </div>
        </ShadowRoot>
    )
}

/**
 * @param {Object} options
 * @param {HTMLElement} [options.element]
 */
function TrainingEntry({ element, setTrainingVisible }) {
    useEffect(() => {
        const abort = new AbortController();
        const node = element.querySelector("ul");
        node.addEventListener("click", () => {
            setTrainingVisible(false);
        }, { signal: abort.signal });
        return () => {
            abort.abort();
        }
    }, []);
    return (
        <ShadowRoot styles={{ height: "100%" }}>
            <StyleSheetLoader />
            <div className={styles.xroot}>
                <div className={styles.xtrainingEntry} onClick={() => {
                    setTrainingVisible(true);
                }}>排行榜</div>
            </div>
        </ShadowRoot >
    )
}
function Training() {
    const [aim, setAim] = useState([]);
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(null);
    const [visible, setVisible] = useState(false);
    const [{ problems }] = useState(() => {
        const node = document.getElementById("lentille-context");
        const content = JSON.parse(node.textContent);
        /** @type {LuoguTraining} */
        const training = content.data.training;
        return { problems: training.problems };
    });
    useEffect(() => {
        /** @type {number} */
        const id = selected ? selected[0] : -1;
        const newAim = [];
        if (id == -1) {
            for (const group of users) {
                newAim.push(...group.accounts);
            }
        } else {
            newAim.push(...users[id].accounts);
        }
        setAim(newAim);
    }, [selected]);
    useEffect(() => {
        const newAim = [];
        const newItems = [[-1, "所有选手"]];
        for (const group of users) {
            newAim.push(...group.accounts);
            newItems.push([newItems.length - 1, group.name]);
        }
        setAim(newAim);
        setItems(newItems);
        if (!selected) setSelected(newItems[0]);
        const node = document.querySelector("main>.main-content");
        const old = node.style.display;
        node.style.display = "none";
        return () => {
            node.style.display = old;
        }
    }, []);
    useLayoutEffect(() => {
        setVisible(true);
    }, []);
    return (
        <ShadowRoot>
            <StyleSheetLoader />
            <FadeAnimation visible={visible}>
                <div className={styles.xroot}>
                    <div className={styles.xtraining}>
                        <div className={styles.xtrainingCard}>
                            <div className={styles.xtrainingHeader}>
                                <span style={{ marginRight: "3px" }}>显示范围</span>
                                <ComboBox items={items} selected={selected} setSelected={setSelected} />
                            </div>
                            <TableView users={aim} problems={problems} />
                        </div>
                    </div>
                </div>
            </FadeAnimation>
        </ShadowRoot>
    )
}

const reactRoot = document.createElement("div");
document.body.appendChild(reactRoot);
const root = createRoot(reactRoot);
function App() {
    const [sideElement, setSideElement] = useState(null);
    const [trainingHeaderElement, setTrainingHeaderElement] = useState(null);
    const [trainingVisible, setTrainingVisible] = useState(false);
    const [trainingElement, setTrainingElement] = useState(false);
    const [pid, setPid] = useState(null);
    const guardId = useRef(null);
    const sideBarObserver = new MutationObserver(mutations => update());
    function update() {
        const newPid = getPid();
        const side = document.getElementsByClassName("side")[0];
        if (side && newPid) {
            setSideElement(side);
            setPid(newPid);
        } else {
            setSideElement(null);
            setPid(null);
        }
        if (side) {
            const side_container = document.getElementsByClassName("sidebar-container")[0];
            sideBarObserver.disconnect();
            if (side_container) sideBarObserver.observe(side_container, { childList: true });
        }
    }
    function guard(cnt = 0) {
        if (guardId.current) {
            clearTimeout(guardId.current);
            guardId.current = null;
        }
        update();
        if (cnt < 10) {
            guardId.current = setTimeout(() => {
                guard(cnt + 1);
            }, 100);
        }
    }
    function guardTable() {
        const url = new URL(location.href);
        const re = new RegExp("^/training/\\d+$");
        console.log("guardTable");
        if (re.test(url.pathname)) {
            setTrainingHeaderElement(document.querySelector(".header-block>.header-card>.bottom-row>.left>.menu"));
            setTrainingElement(document.querySelector("main"));
        } else {
            setTrainingHeaderElement(null);
            setTrainingElement(null);
        }
    }
    useEffect(() => {
        const url = new URL(location.href);
        if (url.hostname === "www.luogu.com.cn" ||
            url.hostname === "www.luogu.com") {
            guard();
            guardTable();
            const unload = subscribe("route", () => {
                guard();
                guardTable();
            });
            return () => {
                unload();
                if (guardId.current) {
                    clearTimeout(guardId.current);
                    guardId.current = null;
                }
            };
        }
    }, []);
    return (
        <>
            {sideElement && createPortal(
                <Card pid={pid} />,
                sideElement
            )}
            {createPortal(
                <DropBox />,
                document.body
            )}
            {trainingHeaderElement && createPortal(
                <TrainingEntry element={trainingHeaderElement} setTrainingVisible={setTrainingVisible} />,
                trainingHeaderElement
            )}
            {trainingVisible && trainingElement && createPortal(
                <Training />,
                trainingElement
            )}
        </>
    );
}
root.render(<App />);

console.log("联考水表机 Frontend Loaded >w<");
