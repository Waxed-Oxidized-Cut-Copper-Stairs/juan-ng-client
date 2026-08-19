// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useMemo, useState } from "react";
import AnimatedView, { Button, FloatDiv, FloatDivBinding, FloatDivContainer, percentToColor, percentToString, Username } from "./Generic";
import styles from "./GroupView.module.css";

import { acquireProblem, flushSpecificCache, subscribe } from "../protocol_v2";
import StatusBar, { OnlineStatusBar } from "./StatusBar";

export function QuickView({ ac, wa, tot, visible }) {
    return (
        <div style={{ display: "inline-block" }}>
            <AnimatedView visible={visible}>
                <div className={styles.quickview}>
                    <span className={styles.ac}>{ac} </span>
                    <span className={styles.wa}>{wa} </span>
                    / {tot}
                    {/* <span style={{ color: percentToColor(Math.cbrt(ac / tot)) }}>{percentToString(ac, tot)}</span> */}
                </div>
            </AnimatedView>
        </div>
    )
}

/**
 * @param {Object} options
 * @param {Account} [options.account]
 * @param {string} [options.pid]
 * @param {number} [options.state]
 */
export function SingleView({ account, pid, state }) {
    return (
        <div className={styles.singleview}>
            <a className={styles.anchor} href={`https://www.luogu.com.cn/record/list?pid=${pid}&user=${account.luogu}`} target="_blank">
                <Username account={account} className={state == 1 ? styles.ac : styles.wa} />
            </a>
        </div>
    )
}

/**
 * @param {Object} options
 * @param {Group} [options.group] 注意：假设 group 不变
 * @param {string} [options.pid]
 * @param {Set<number>} [options.passed]
 * @param {Set<number>} [options.submitted]
 * @param {boolean} [options.verbose]
 */
export function SingleGroupView({ group, pid, passed, submitted, verbose = false }) {
    const [visible, setVisible] = useState(false);
    const { cntAC, cntWA } = useMemo(() => {
        let cntAC = 0, cntWA = 0;
        for (const account of group.accounts) {
            if (passed.has(account.luogu)) ++cntAC;
            else if (submitted.has(account.luogu)) ++cntWA;
        }
        return { cntAC, cntWA };
    }, [passed, submitted]);
    if (!(cntAC > 0 || cntWA > 0)) return null;
    const div = (
        <div>
            {group.accounts.map((account, idx, arr) => {
                const state = passed.has(account.luogu) ? 1 : (submitted.has(account.luogu) ? 2 : 0);
                if (!state) return null;
                return (
                    <SingleView key={idx} account={account} pid={pid} state={state} />
                )
            })}
        </div>
    );
    if (verbose) {
        return (
            <div
                className={styles.singlegroup}
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
            >
                <FloatDivContainer>
                    <FloatDiv>
                        <div className={styles.quickoperation}>
                            <div className={styles.detailview}>
                                <div className={styles.detailviewL}>
                                    <strong className={styles.ac}>{cntAC}</strong>
                                    <br />
                                    <strong className={styles.wa}>{cntWA}</strong>
                                    <br />
                                    <strong>{group.accounts.length}</strong>
                                </div>
                                <div className={styles.detailviewR}>
                                    <span className={styles.emphasize}> Passed</span>
                                    <br />
                                    <span className={styles.emphasize}> Submitted</span>
                                    <br />
                                    <span className={styles.emphasize}> In Total</span>
                                </div>
                            </div>
                            <div className={styles.percentview}>
                                通过率
                                <span className={styles.percentviewem} style={{ color: percentToColor(Math.cbrt(cntAC / group.accounts.length)) }}> {percentToString(cntAC, group.accounts.length)}</span>
                            </div>
                            <Button onClick={() => flushSpecificCache(group.accounts)}>刷新</Button>
                        </div>
                    </FloatDiv>
                    <FloatDivBinding>
                        <div className={styles.groupname}>{group.name}</div>
                        {div}
                    </FloatDivBinding>
                </FloatDivContainer>
            </div>
        )
    } else {
        return (
            <div
                className={styles.singlegroup}
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
            >
                <div>
                    <div className={styles.groupname}>{group.name}</div>
                    <div className={styles.rightview}>
                        <QuickView ac={cntAC} wa={cntWA} tot={group.accounts.length} visible={visible} />
                    </div>
                </div>
                {div}
            </div>
        )
    }
}

/**
 * @param {Object} options
 * @param {Group[]} [options.groups] 注意：假设 groups 不变
 * @param {string} [options.pid]
 * @param {boolean} [options.verbose]
 */
export function GroupView({ groups, pid, children, verbose }) {
    const [passed, setPassed] = useState(new Set());
    const [submitted, setSubmitted] = useState(new Set());
    let cancelled = false;
    async function update() {
        const situation = await acquireProblem(pid);
        if (cancelled) return;
        if (!situation) {
            return;
        }
        setPassed(new Set(situation.passed));
        setSubmitted(new Set(situation.submitted));
    }
    useEffect(() => {
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => update(), { signal: abort.signal });
        const unload = subscribe("problem", () => update());
        return () => {
            abort.abort();
            unload();
        }
    }, []);
    useEffect(() => {
        update();
        return () => {
            cancelled = true;
        }
    }, [pid]);
    let tot = 0;
    for (const group of groups) tot += group.accounts.length;
    return (
        <div>
            <div class={styles.header}>
                <div className={styles.leftview}>{children}</div>
                <StatusBar />
                <div className={styles.rightview}>
                    <QuickView ac={passed.size} wa={submitted.size} tot={tot} visible={true} />
                </div>
            </div>
            <OnlineStatusBar />
            <div>
                {groups.map((group, idx, arr) => {
                    return (
                        <SingleGroupView key={idx} group={group} pid={pid} passed={passed} submitted={submitted} verbose={verbose} />
                    )
                })}
            </div>
        </div>
    )
}