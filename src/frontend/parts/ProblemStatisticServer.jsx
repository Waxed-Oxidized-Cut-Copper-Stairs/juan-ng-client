// SPDX-License-Identifier: GPL-3.0-or-later

import { cloneElement, isValidElement, useCallback, useEffect, useState } from "react";
import { subscribe } from "../bus";
import { getAccountList, getGroupList, getUserList, queryPid } from "../protocol";

/**
 * @param {Object} options
 * @param {PID} options.pid
 */
export function ProblemStatisticServer({ children, pid }) {
    /** @type {UseState<Map<InternalID, Account>>} */
    const [accounts, setAccounts] = useState(new Map());
    /** @type {UseState<Map<InternalID, User>>} */
    const [users, setUsers] = useState(new Map());
    /** @type {UseState<Group[]>} */
    const [groups, setGroups] = useState([]);
    /** @type {UseState<Set<InternalID>>} */
    const [passed, setPassed] = useState(new Set());
    /** @type {UseState<Set<InternalID>>} */
    const [submitted, setSubmitted] = useState(new Set());
    const updateMeta = useCallback(async () => {
        const newAccounts = await getAccountList();
        const newUsers = await getUserList();
        const newGroups = await getGroupList();
        const newAccountsMp = new Map();
        const newUsersMp = new Map();
        for (const account of newAccounts) {
            newAccountsMp.set(account.id, account);
        }
        for (const user of newUsers) {
            newUsersMp.set(user.id, user);
        }
        setAccounts(newAccountsMp);
        setUsers(newUsersMp);
        setGroups(newGroups);
    }, []);
    const updateData = useCallback(async () => {
        const { passed: newPassed, submitted: newSubmitted } = await queryPid(pid);
        setPassed(new Set(newPassed));
        setSubmitted(new Set(newSubmitted));
    }, []);
    useEffect(() => {
        updateMeta();
        updateData();
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => {
            updateMeta();
            updateData();
        }, { signal: abort.signal });
        const unload1 = subscribe("profile", () => updateMeta());
        const unload2 = subscribe("problem", () => updateData());
        return () => {
            abort.abort();
            unload1();
            unload2();
        }
    }, [updateMeta, updateData]);
    if (!isValidElement(children)) throw new Error("ProblemStatisticServer should have only one child.");
    return cloneElement(children, { pid, accounts, users, groups, passed, submitted });
}