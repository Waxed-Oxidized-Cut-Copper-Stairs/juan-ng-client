// SPDX-License-Identifier: GPL-3.0-or-later

import { StrictMode, useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import AccountsPanel from "../components/AccountsPanel";
import styles from "./management.module.css";
import { emit } from "../bus";

export default function Main() {
    const [tab, setTab] = useState("accounts");
    const lastTab = useRef(null);
    const selfId = useId();
    useEffect(() => {
        if (lastTab.current === tab) return;
        const mp = {
            accounts: "AccountsPanel",
            groups: "!undefined",
            tool: "!undefined",
            help: "!undefined",
            about: "!undefined",
        };
        if (lastTab.current) {
            emit(`${selfId}.${mp[lastTab.current]}.unfocus`);
        }
        emit(`${selfId}.${mp[tab]}.focus`);
        lastTab.current = tab;
    }, [tab]);
    return (
        <div className={styles.main}>
            <header>
                <h1>Management</h1>
            </header>
            <nav className={styles.tabs}>
                {[
                    ["accounts", "账号"],
                    ["groups", "分组"],
                    ["tool", "工具"],
                    ["help", "帮助"],
                    ["about", "关于"],
                ].map(([key, label]) => (
                    <div className={styles.tab}>
                        <button
                            key={key}
                            type="button"
                            className={styles.tabbtn}
                            data-active={tab === key ? "true" : undefined}
                            onClick={() => setTab(key)}>
                            {label}
                        </button>
                    </div>
                ))}
            </nav>
            <main className={styles.body}>
                <div className={styles.page} style={{ display: (tab == "accounts" ? "" : "none") }}>
                    <AccountsPanel busId={selfId} />
                </div>
            </main>
        </div>
    )
}

createRoot(document.getElementById("app")).render(
    <StrictMode>
        <Main />
    </StrictMode>
);