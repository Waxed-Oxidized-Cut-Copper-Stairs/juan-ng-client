// SPDX-License-Identifier: GPL-3.0-or-later

/** @type {Group[]}} */
const users = await chrome.runtime.sendMessage({ dst: "sw", type: "query-users" });

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import FadeAnimation, { Button, clampCoord, ComboBox, getPid, ShadowRoot } from "./components/Generic.jsx";
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
    const [current, setCurrent] = useState(null);
    const dropboxRef = useRef(null);
    const nxtRef = useRef(null);
    const nxtPidRef = useRef(null);
    const hideRef = useRef(false);
    const showNow = useCallback(() => {
        if (nxtRef.current === null) return;
        setVisible(true);
        setCurrent(nxtRef.current);
        setPid(nxtPidRef.current);
        nxtRef.current = null;
        nxtPidRef.current = null;
    }, []);
    const hideNow = useCallback(() => {
        if (!hideRef.current) return;
        setVisible(false);
        setCurrent(null);
        hideRef.current = false;
        if (nxtRef.current !== null) {
            showNow();
        }
    }, [showNow]);
    const show = useCallback((node, newPid) => {
        if (current === node) return;
        nxtRef.current = node;
        nxtPidRef.current = newPid;
        setTimeout(() => {
            showNow();
        }, 150);
    }, [current, showNow]);
    const hide = useCallback(() => {
        hideRef.current = true;
        setTimeout(() => {
            hideNow();
        }, 150);
    }, [hideNow]);
    const hideAll = useCallback(() => {
        setVisible(false);
        setCurrent(null);
        nxtRef.current = null;
        nxtPidRef.current = null;
        hideRef.current = false;
    }, []);
    const handleNode = useCallback((node, signal) => {
        if (node.hasAttribute("juan-watching")) return;
        node.setAttribute("juan-watching", "");
        node.addEventListener("mouseenter", () => {
            if (!node.href) return;
            const newPid = getPid(new URL(node.href));
            if (newPid && (!newPid.startsWith("U") || newPid.startsWith("UVA")) && !newPid.startsWith("T")) {
                show(node, newPid);
            }
        }, { signal });
        node.addEventListener("mouseleave", () => {
            if (current === node) hide();
            if (nxtRef.current === node) {
                nxtRef.current = null;
                nxtPidRef.current = null;
            }
        }, { signal });
        return () => {
            node.removeAttribute("juan-watching");
        };
    }, [current, show, hide]);
    useEffect(() => {
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => hideAll(), { signal: abort.signal });
        const unloads = [];
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
    }, [hideAll, handleNode]);
    useLayoutEffect(() => {
        if (!visible || !dropboxRef.current || !current) return;
        const node = current;
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
        /** @type {HTMLElement} */
        const box = dropboxRef.current;
        let anchor;
        let top, left;
        if (spaceRight < 200) {
            anchor = "bottom";
            top = rect.bottom + 5;
            left = rect.left;
        } else {
            anchor = "right";
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
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
        void box.offsetWidth;
        if (anchor == "right") top -= 0.37 * box.offsetHeight;
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
        void box.offsetWidth;
        const coord = clampCoord(anchor, left, top, box.offsetWidth, box.offsetHeight, 0, 0, window.innerWidth, window.innerHeight);
        if (coord) {
            top = coord.top;
            left = coord.left;
        }
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
    }, [visible, current]);
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
                        onMouseEnter={() => { hideRef.current = false; }}
                        onMouseLeave={() => hide()}
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
                        <Button onClick={() => { flushCache(); }} confirm="此操作将刷新缓存，可能消耗较长时间。确定要刷新缓存吗？">刷新缓存</Button>
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
        try {
            const content = JSON.parse(node.textContent);
            /** @type {LuoguTraining} */
            const training = content.data.training;
            return { problems: training.problems };
        } catch (err) {
            return {};
        }
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
                            {problems === undefined ? (
                                <div className={styles.banner} onClick={() => window.location.reload()}>
                                    无法读取题单数据，请刷新页面
                                </div>
                            ) : (
                                <TableView users={aim} problems={problems} />
                            )}
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
    const guardTableId = useRef(null);
    const sideBarObserver = new MutationObserver(mutations => update());
    function clearGuardTimer() {
        if (guardId.current) {
            clearTimeout(guardId.current);
            guardId.current = null;
        }
    }
    function clearGuardTableTimer() {
        if (guardTableId.current) {
            clearTimeout(guardTableId.current);
            guardTableId.current = null;
        }
    }
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
        clearGuardTimer();
        update();
        if (cnt < 10) {
            guardId.current = setTimeout(() => {
                guard(cnt + 1);
            }, 100);
        }
    }
    function _guardTable(cnt = 0) {
        const nd1 = document.querySelector(".header-block>.header-card>.bottom-row>.left>.menu");
        const nd2 = document.querySelector("main");
        if (nd1 && nd2) {
            setTrainingHeaderElement(nd1);
            setTrainingElement(nd2);
        } else if (cnt < 10) {
            guardTableId.current = setTimeout(() => {
                _guardTable(cnt + 1);
            }, 100);
        }
    }
    function guardTable() {
        const url = new URL(location.href);
        const re = new RegExp("^/training/\\d+$");
        if (re.test(url.pathname)) {
            _guardTable();
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
                clearGuardTimer();
                clearGuardTableTimer();
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
