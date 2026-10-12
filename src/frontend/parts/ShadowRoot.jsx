// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ShadowRoot.module.scss";

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
            {root && createPortal(
                <div className={styles.xroot}>
                    <div className={styles.xbody}>
                        {children}
                    </div>
                </div>,
                root)}
        </div>
    )
}