// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useMemo, useState } from "react";
import AnimatedView, { Button, FloatDiv, FloatDivBinding, FloatDivContainer, percentToColor, percentToString, Username } from "./Generic";
import styles from "./GroupView.module.css";

import { acquireProblem, acquireUserProfile, flushSpecificCache, subscribe } from "../protocol_v2";
import StatusBar, { OnlineStatusBar } from "./StatusBar";

export function QuickView({ ac, wa, na, tot, visible }) {
    return (
        <div style={{ display: "inline-block" }}>
            <AnimatedView visible={visible}>
                <div className={styles.quickview}>
                    <span className={styles.ac}>{ac} </span>
                    <span className={styles.wa}>{wa} </span>
                    <span className={styles.na}>{na} </span>
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
 * @param {Map<number, LuoguProfileNew>} [options.profiles]
 * @param {boolean} [options.verbose]
 */
export function SingleGroupView({ group, pid, passed, submitted, profiles, verbose = false }) {
    const [visible, setVisible] = useState(false);
    const { cntAC, cntWA, cntNA } = useMemo(() => {
        let cntAC = 0, cntWA = 0, cntNA = 0;
        for (const { luogu: uid } of group.accounts) {
            if (passed.has(uid)) ++cntAC;
            else if (submitted.has(uid)) ++cntWA;
            else if (profiles.has(uid) && profiles.get(uid).privacy) ++cntNA;
        }
        return { cntAC, cntWA, cntNA };
    }, [passed, submitted, profiles]);
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
                                    <strong className={styles.na}>{cntNA}</strong>
                                    <br />
                                    <strong>{group.accounts.length}</strong>
                                </div>
                                <div className={styles.detailviewR}>
                                    <span className={`${styles.emphasize} ${styles.ac}`}> Passed</span>
                                    <br />
                                    <span className={`${styles.emphasize} ${styles.wa}`}> Submitted</span>
                                    <br />
                                    <span className={`${styles.emphasize} ${styles.na}`}> Abstention</span>
                                    <br />
                                    <span className={styles.emphasize}> In Total</span>
                                </div>
                            </div>
                            <div className={styles.percentview}>
                                通过率
                                <span className={styles.percentviewem} style={{ color: percentToColor(Math.cbrt(cntAC / (group.accounts.length - cntNA))) }}> {percentToString(cntAC, group.accounts.length - cntNA)}</span>
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
    const [profiles, setProfiles] = useState(new Map());
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
    async function updateProfile() {
        const newProfiles = new Map();
        const promises = [];
        for (const group of groups) {
            for (const account of group.accounts) {
                const uid = account.luogu;
                promises.push(acquireUserProfile(uid).then((profile) => {
                    if (!profile) return;
                    newProfiles.set(uid, profile);
                }));
            }
        }
        await Promise.allSettled(promises);
        if (cancelled) return;
        setProfiles(newProfiles);
    }
    useEffect(() => {
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => update(), { signal: abort.signal });
        const unload1 = subscribe("problem", () => update());
        const unload2 = subscribe("progress", () => updateProfile());
        return () => {
            abort.abort();
            unload1();
            unload2();
        }
    }, []);
    useEffect(() => {
        update();
        updateProfile();
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
                        <SingleGroupView key={idx} group={group} pid={pid} passed={passed} submitted={submitted} profiles={profiles} verbose={verbose} />
                    )
                })}
            </div>
        </div>
    )
}