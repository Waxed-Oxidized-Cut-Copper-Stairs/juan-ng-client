// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useMemo, useState } from "react";
import AnimatedView, { Button, FloatDiv, FloatDivBinding, FloatDivContainer, OriginAnchor, percentToColor, percentToString, Username } from "./Generic";
import styles from "./GroupView.module.css";

import { acquireOrigin, acquireProblem, acquireUserProfile, flushSpecificCache, subscribe } from "../protocol_v2";
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
 * @param {Account} options.account
 * @param {LuoguProfileNew} options.profile
 * @param {string} options.pid
 * @param {Origin} options.origin
 * @param {number} options.state
 */
export function SingleView({ account, profile, pid, origin, state }) {
    return (
        <div className={styles.singleview}>
            <OriginAnchor account={account} pid={pid} origin={origin}>
                <Username account={account} profile={profile} className={state == 1 ? styles.ac : styles.wa} />
            </OriginAnchor>
        </div >
    )
}

/**
 * @param {Object} options
 * @param {Group} options.group 注意：假设 group 不变
 * @param {string} options.pid
 * @param {Set<number>} options.passed
 * @param {Set<number>} options.submitted
 * @param {Map<number, LuoguProfileNew>} options.profiles
 * @param {Origin} options.origin
 * @param {boolean} [options.verbose=false]
 */
export function SingleGroupView({ group, pid, passed, submitted, profiles, origin, verbose = false }) {
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
                const uid = account.luogu;
                const state = passed.has(uid) ? 1 : (submitted.has(uid) ? 2 : 0);
                if (!state) return null;
                return (
                    <SingleView key={idx} account={account} profile={profiles.get(uid) ?? {}} pid={pid} origin={origin} state={state} />
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
                <FloatDivContainer steady={false}>
                    <FloatDiv anchor={["left", "right"]} strict={true}>
                        <div className={styles.quickconclusion}>
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
                            <div>
                                通过率
                                <span className={styles.percentview} style={{ color: percentToColor(Math.cbrt(cntAC / (group.accounts.length - cntNA))) }}> {percentToString(cntAC, group.accounts.length - cntNA)}</span>
                            </div>
                            <hr className={styles.hr} />
                            <div className={styles.quickoperation}>
                                <div><Button
                                    onClick={() => {
                                        flushSpecificCache(group.accounts, ["cf", "at"]);
                                        const accounts = [];
                                        for (const account of group.accounts) {
                                            if (account.pri > 0) {
                                                accounts.push(account);
                                            }
                                        }
                                        flushSpecificCache(accounts, ["lg"]);
                                    }}
                                    title="刷新 CF/AT 和 pri>0 的洛谷缓存"
                                >刷新缓存</Button></div>
                                <div><Button onClick={() => flushSpecificCache(group.accounts, ["lg"])} confirm="此操作将刷新洛谷平台缓存，可能消耗较长时间。确定要刷新缓存吗？">刷新洛谷</Button></div>
                            </div>
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
                        <QuickView ac={cntAC} wa={cntWA} na={cntNA} tot={group.accounts.length} visible={visible} />
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
    const [origin, setOrigin] = useState({ passed: new Map(), submitted: new Map() });
    const [cntNA, setCntNA] = useState(0);
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
        let newCntNA = 0;
        const promises = [];
        for (const group of groups) {
            for (const account of group.accounts) {
                const uid = account.luogu;
                promises.push(acquireUserProfile(uid).then((profile) => {
                    if (!profile) return;
                    if (profile.privacy) ++newCntNA;
                    newProfiles.set(uid, profile);
                }));
            }
        }
        await Promise.allSettled(promises);
        if (cancelled) return;
        setProfiles(newProfiles);
        setCntNA(newCntNA);
    }
    async function updateOrigin() {
        const origin = await acquireOrigin(pid);
        if (cancelled) return;
        setOrigin(origin);
    }
    useEffect(() => {
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => {
            update();
            updateProfile();
            updateOrigin();
        }, { signal: abort.signal });
        const unload1 = subscribe("problem", () => update());
        const unload2 = subscribe("profile", () => {
            updateProfile();
            updateOrigin();
        });
        return () => {
            abort.abort();
            unload1();
            unload2();
        }
    }, []);
    useEffect(() => {
        update();
        updateProfile();
        updateOrigin();
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
                    <QuickView ac={passed.size} wa={submitted.size} na={cntNA} tot={tot} visible={true} />
                </div>
            </div>
            <OnlineStatusBar />
            <div>
                {groups.map((group, idx, arr) => {
                    return (
                        <SingleGroupView key={idx} group={group} pid={pid} passed={passed} submitted={submitted} profiles={profiles} origin={origin} verbose={verbose} />
                    )
                })}
            </div>
        </div>
    )
}