// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from "react";
import { acquireProgress, ping, subscribe } from "../protocol_v2";
import FadeAnimation, { percentToColor, percentToString } from "./Generic";
import styles from "./StatusBar.module.css";

export default function StatusBar() {
    const barRef = useRef(null);
    const textRef = useRef(null);
    const [visible, setVisible] = useState(true);
    const [done, setDone] = useState(0);
    const [total, setTotal] = useState(0);
    const handleProgress = useCallback((data) => {
        setDone(data?.done ?? 0);
        setTotal(data?.total ?? 0);
    }, []);
    useEffect(() => {
        /** @type {HTMLElement} */
        const bar = barRef.current;
        if (done == total) {
            bar.style.width = `100%`;
            bar.style.backgroundColor = percentToColor(1);
            textRef.current.textContent = `${percentToString(1, 1)} (${done}/${total})`;
            setVisible(false);
        } else {
            const p = done / total;
            bar.style.width = `${p * 100}%`;
            bar.style.backgroundColor = percentToColor(p);
            textRef.current.textContent = `${percentToString(done, total)} (${done}/${total})`;
            setVisible(true);
        }
    }, [done, total]);
    useEffect(() => {
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => {
            acquireProgress().then(data => handleProgress(data));
        }, { signal: abort.signal });
        acquireProgress().then(data => handleProgress(data));
        const unload = subscribe("progress", (data) => handleProgress(data));
        return () => {
            abort.abort();
            unload();
        }
    }, []);
    return (
        <FadeAnimation visible={visible}>
            <div className={styles.statusbar}>
                <span ref={barRef} className={styles.bar} />
                <span ref={textRef} />
            </div>
        </FadeAnimation>
    )
}

export function OnlineStatusBar() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!ping())
            setVisible(true);
        const unload = subscribe("outdate", () => {
            setVisible(true);
        });
        return () => {
            unload();
        }
    }, []);
    return (
        <FadeAnimation visible={visible}>
            <div className={styles.onlinebar} onClick={() => window.location.reload()}>
                会话已过期，请刷新页面
            </div>
        </FadeAnimation>
    )
}