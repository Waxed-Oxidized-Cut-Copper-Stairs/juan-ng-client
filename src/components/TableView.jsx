// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from "react";
import FadeAnimation, { FloatDiv, FloatDivBinding, FloatDivContainer } from "./Generic";
import styles from "./TableView.module.css";
import { acquireProblem, acquireUserProfile, subscribe } from "../protocol_v2";

/**
 * @param {Object} options
 * @param {LuoguProblemDetail[]} [options.problems]
 */
function HeaderView({ problems, ref }) {
    return (
        <div ref={ref} className={styles.header}>
            {problems.map((problem) => {
                return (
                    <FloatDivContainer holdFloat={false}>
                        <FloatDiv anchor={["top"]}>
                            <div>{problem.pid} {problem.name}</div>
                        </FloatDiv>
                        <FloatDivBinding className={styles.header_cell}>
                            {problem.pid}
                        </FloatDivBinding>
                    </FloatDivContainer>
                )
            })}
        </div>
    )
}

/**
 * @param {Object} options
 * @param {Account[]} [options.users]
 * @param {Map<number, LuoguProfileNew>} [options.profiles]
 * @param {Map<number, number>} [options.count]
 */
function TitleView({ users, profiles, count }) {
    return (
        <div className={styles.title}>
            <div className={styles.special_cell} />
            {users.map((account) => {
                return (
                    <div key={account.luogu} className={`${styles.title_cell} ${profiles.get(account.luogu)?.privacy ? styles.privacy : ""}`.trim()}>
                        <div className={styles.title_cell_left}>{profiles.get(account.luogu)?.name ?? `UID ${account.luogu}`}</div>
                        <div className={styles.title_cell_right}>{count.get(account.luogu) ?? -1}</div>
                    </div>
                )
            })}
        </div>
    )
}

/**
 * @param {Object} options
 * @param {Account} [options.account]
 * @param {LuoguProfileNew} [options.profile]
 * @param {{problem: LuoguProblem, situation: { passed: Set<number>, submitted: Set<number> }}[]} [options.problems]
 */
function RowView({ account, profile, problems }) {
    return (
        <div>
            {problems.map(({ problem, situation }) => {
                return (
                    <div key={problem.pid} className={styles.cell}>
                        {situation.submitted.has(account.luogu) && !situation[1].has(account.luogu) && <div className={styles.submitted}>✗</div>}
                        {situation.passed.has(account.luogu) && <div className={styles.passed}>✓</div>}
                    </div>
                )
            })}
        </div>
    )
}

/**
 * @param {Object} options
 * @param {Account[]} [options.users]
 * @param {LuoguProblemDetail[]} [options.problems]
 */
export default function TableView({ users, problems }) {
    const [prob, setProb] = useState([]);
    const [profiles, setProfiles] = useState(new Map());
    const [order, setOrder] = useState([]);
    const [count, setCount] = useState(new Map());
    const headerRef = useRef(null);
    const headerBakRef = useRef(null);
    const maskRef = useRef(null);
    const bodyRef = useRef(null);
    const [headerBakVisible, setHeaderBakVisible] = useState(false);
    const update = useCallback(async () => {
        const newProb = [];
        const newProfiles = new Map();
        const promises = [];
        for (const problem of problems) {
            const idx = newProb.length;
            newProb.push({ problem });
            promises.push(acquireProblem(problem.pid).then((situation) => {
                if (situation) {
                    newProb[idx].situation = {
                        passed: new Set(situation.passed),
                        submitted: new Set(situation.submitted)
                    };
                } else {
                    newProb[idx].situation = {
                        passed: new Set(),
                        submitted: new Set()
                    };
                }
            }));
        }
        for (const account of users) {
            const uid = account.luogu;
            promises.push(acquireUserProfile(uid).then((profile) => {
                if (!profile) return;
                newProfiles.set(uid, profile);
            }));
        }
        await Promise.allSettled(promises);
        setProb(newProb);
        setProfiles(newProfiles);
    }, [users, problems]);
    const updateScroll = useCallback(() => {
        /** @type {HTMLDivElement} */
        const div = headerRef.current;
        /** @type {HTMLDivElement} */
        const bak = headerBakRef.current;
        /** @type {HTMLDivElement} */
        const mask = maskRef.current;
        /** @type {HTMLDivElement} */
        const body = bodyRef.current;
        if (!div || !bak || !mask || !body) return;
        const rect = div.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        if (rect.top > 56) {
            setHeaderBakVisible(false);
        } else {
            setHeaderBakVisible(true);
            bak.style.position = "relative";
            bak.style.left = `${-body.scrollLeft}px`;
            mask.style.left = `${bodyRect.left}px`;
            mask.style.width = `${bodyRect.width}px`;
        }
    }, []);
    useEffect(() => {
        const val = new Map();
        for (const account of users) {
            const uid = account.luogu;
            /** @type {LuoguProfileNew} */
            const profile = profiles.get(uid);
            if (profile && profile.privacy) val.set(uid, -1);
            else {
                let cnt = 0;
                for (const { situation } of prob) if (situation.passed.has(uid)) ++cnt;
                val.set(uid, cnt);
            }
        }
        setOrder(users.slice().sort((a, b) => val.get(b.luogu) - val.get(a.luogu)));
        setCount(val);
    }, [prob, profiles]);
    useEffect(() => {
        update();
        updateScroll();
        const abort = new AbortController();
        document.addEventListener("scroll", () => {
            updateScroll();
        }, { signal: abort.signal });
        const unload = subscribe("problem", () => update());
        return () => {
            abort.abort();
            unload();
        };
    }, [users, problems, update, updateScroll]);
    return (
        <div>
            <div className={styles.table}>
                <TitleView users={order} profiles={profiles} count={count} />
                <div ref={bodyRef} className={styles.body} onScroll={() => updateScroll()}>
                    <HeaderView ref={headerRef} problems={problems} />
                    {order.map((account) => {
                        return (
                            <RowView key={account.luogu} account={account} profile={profiles.get(account.luogu)} problems={prob} />
                        )
                    })}
                </div>
            </div>
            <FadeAnimation visible={headerBakVisible}>
                <div ref={maskRef} className={styles.mask}>
                    <HeaderView ref={headerBakRef} problems={problems} />
                </div>
            </FadeAnimation>
        </div>
    )
}