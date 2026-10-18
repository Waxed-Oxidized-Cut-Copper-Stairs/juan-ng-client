// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { getPid } from "../toolkit";
import { createPortal } from "react-dom";
import { ShadowRoot } from "../parts/ShadowRoot";
import cssText from "virtual:shadow-css";
import { ProblemStatisticServer } from "../components/ProblemStatisticServer";
import { GroupView } from "../components/GroupView";

function StyleSheetLoader() {
    const nodeRef = useRef(null);
    useEffect(() => {
        if (!nodeRef.current) return;
        nodeRef.current.textContent = cssText;
    }, []);
    return <style ref={nodeRef} />
}

function Card({ pid }) {
    return (
        <>
            <StyleSheetLoader />
            <ProblemStatisticServer pid={pid}>
                <GroupView>
                    <div>
                        <strong style={{ fontSize: "18px" }}>卷王</strong>
                        <span style={{ fontSize: "8px", verticalAlign: "bottom", padding: "0 3px" }}>v3</span>
                    </div>
                </GroupView>
            </ProblemStatisticServer>
        </>
    )
}

const reactRoot = document.createElement("div");
document.body.appendChild(reactRoot);
const root = createRoot(reactRoot);
function App() {
    const [sideElement, setSideElement] = useState(null);
    const [pid, setPid] = useState(null);
    const guardId = useRef(null);
    const sideBarObserver = new MutationObserver(mutations => update());
    function clearGuardTimer() {
        if (guardId.current) {
            clearTimeout(guardId.current);
            guardId.current = null;
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
    useEffect(() => {
        const url = new URL(location.href);
        if (url.hostname === "www.luogu.com.cn" ||
            url.hostname === "www.luogu.com") {
            // const node = document.getElementById("lentille-context");
            // if (node) {
            //     chrome.runtime.sendMessage({ dst: "sw", type: "fuck-you-lg", data: node.textContent });
            // }
            guard();
            // const unload = subscribe("route", () => {
            //     guard();
            // });
            return () => {
                // unload();
                clearGuardTimer();
            };
        }
    }, []);
    return (
        <>
            {sideElement && createPortal(
                <ShadowRoot><Card pid={pid} /></ShadowRoot>,
                sideElement
            )}
        </>
    );
}
root.render(<App />);

console.log("联考水表机 v3 Frontend Loaded >w<");
