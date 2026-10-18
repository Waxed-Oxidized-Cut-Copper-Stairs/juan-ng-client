// SPDX-License-Identifier: GPL-3.0-or-later

import { cloneElement, isValidElement, useCallback, useEffect, useState } from "react";
import { subscribe } from "../bus";
import { getAccountList, getGroupList, getUserList } from "../protocol";

export function MetaDataServer({ children, ...rest }) {
    /** @type {UseState<Map<InternalID, Account>>} */
    const [accounts, setAccounts] = useState(new Map());
    /** @type {UseState<Map<InternalID, User>>} */
    const [users, setUsers] = useState(new Map());
    /** @type {UseState<Group[]>} */
    const [groups, setGroups] = useState([]);
    const update = useCallback(async () => {
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
    useEffect(() => {
        update();
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => {
            update();
        }, { signal: abort.signal });
        const unload = subscribe("profile", () => update());
        return () => {
            abort.abort();
            unload();
        }
    }, [update]);
    if (!isValidElement(children)) throw new Error("MetaDataServer should have only one child.");
    return cloneElement(children, { accounts, users, groups, ...rest });
}