// SPDX-License-Identifier: GPL-3.0-or-later

import { useMemo, useState } from "react";
import styles from "./GroupView.module.css";

/**
 * @param {Object} options
 * @param {Group} options.group
 * @param {Map<InternalID, Account>} options.accounts
 * @param {Map<InternalID, User>} options.users
 * @param {Set<InternalID>} options.passed
 * @param {Set<InternalID>} options.submitted
 */
function countForGroup({ group, accounts, users, passed, submitted }) {
    let cntAC = 0, cntWA = 0, cntNA = 0;
    for (const userId of group.members) {
        const user = users.get(userId);
        let ac = false, wa = false, hasData = false;
        for (const accountId of user.accounts) {
            const account = accounts.get(accountId);
            if (account && account?.last_updated) hasData = true;
            if (passed.has(accountId)) ac = true;
            if (submitted.has(accountId)) wa = true;
        }
        if (ac) ++cntAC;
        else if (wa) ++cntWA;
        else if (!hasData) ++cntNA;
    }
    return { cntAC, cntWA, cntNA };
}

export function QuickView({ ac, wa, na, tot, visible }) {
    return (
        <div className={styles.quickview}>
            <span className={styles.ac}>{ac} </span>
            <span className={styles.wa}>{wa} </span>
            <span className={styles.na}>{na} </span>
            / {tot}
        </div>
    )
}

/**
 * @param {Object} options
 * @param {PID} options.pid
 * @param {User} options.user
 * @param {Map<InternalID, Account>} options.accounts
 * @param {Set<InternalID>} options.passed
 * @param {Set<InternalID>} options.submitted
 */
export function SingleView({ pid, user, accounts, passed, submitted }) {
    return (
        <div className={styles.single_view}>
            {user.display_name.value}
        </div >
    )
}

/**
 * @param {Object} options
 * @param {PID} options.pid
 * @param {Group} options.group
 * @param {Map<InternalID, Account>} options.accounts
 * @param {Map<InternalID, User>} options.users
 * @param {Set<InternalID>} options.passed
 * @param {Set<InternalID>} options.submitted
 */
export function SingleGroupView({ pid, group, accounts, users, passed, submitted }) {
    const [visible, setVisible] = useState(false);
    const { cntAC, cntWA, cntNA } = useMemo(() => countForGroup({ group, accounts, users, passed, submitted }), [group, accounts, users, passed, submitted]);
    if (!(cntAC > 0 || cntWA > 0)) return null;
    return (
        <div
            className={styles.single_group}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <div className={styles.header}>
                <div className={styles.title_container}>{group.name}</div>
                <div>
                    <QuickView ac={cntAC} wa={cntWA} na={cntNA} tot={group.members.length} visible={visible} />
                </div>
            </div>
            <div>
                {group.members.map((userId, idx, arr) => {
                    const user = users.get(userId);
                    return <SingleView key={userId} pid={pid} user={user} accounts={accounts} passed={passed} submitted={submitted} />
                })}
            </div>
        </div>
    )
}

/**
 * @param {Object} options
 * @param {PID} options.pid
 * @param {Map<InternalID, Account>} options.accounts
 * @param {Map<InternalID, User>} options.users
 * @param {Group[]} options.groups
 * @param {Set<InternalID>} options.passed
 * @param {Set<InternalID>} options.submitted
 */
export function GroupView({ children, pid, accounts, users, groups, passed, submitted }) {
    let cntAC = 0, cntWA = 0, cntNA = 0, tot = 0;
    for (const group of groups) {
        tot += group.members.length;
        const { cntAC: ac, cntWA: wa, cntNA: na } = countForGroup({ group, accounts, users, passed, submitted });
        cntAC += ac;
        cntWA += wa;
        cntNA += na;
    }
    return (
        <div>
            <div className={styles.header}>
                <div className={styles.title_container}>{children}</div>
                <div>
                    <QuickView ac={cntAC} wa={cntWA} na={cntNA} tot={tot} visible={true} />
                </div>
            </div>
            <div>
                {groups.map((group, idx, arr) => {
                    return <SingleGroupView key={group.id} pid={pid} group={group} accounts={accounts} users={users} passed={passed} submitted={submitted} />
                })}
            </div>
        </div>
    )
}