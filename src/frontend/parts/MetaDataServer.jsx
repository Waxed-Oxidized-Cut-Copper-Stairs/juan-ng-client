// SPDX-License-Identifier: GPL-3.0-or-later

import { cloneElement, isValidElement, useCallback, useEffect, useState } from "react";
import { subscribe } from "../bus";
import { getAccountList, getGroupList, getGroupOrder, getUserList } from "../protocol";

export function MetaDataServer({ children, ...rest }) {
    /** @type {UseState<Map<InternalID, Account>>} */
    const [accounts, setAccounts] = useState(new Map());
    /** @type {UseState<Map<InternalID, User>>} */
    const [users, setUsers] = useState(new Map());
    /** @type {UseState<Map<InternalID, Group>>} */
    const [groups, setGroups] = useState(new Map());
    /** @type {UseState<InternalID[]>} */
    const [order, setOrder] = useState([]);
    const update = useCallback(async () => {
        const newAccounts = await getAccountList();
        const newUsers = await getUserList();
        const newGroups = await getGroupList();
        const newOrder = await getGroupOrder();
        const newAccountsMp = new Map();
        const newUsersMp = new Map();
        const newGroupsMp = new Map();
        for (const account of newAccounts) {
            newAccountsMp.set(account.id, account);
        }
        for (const user of newUsers) {
            newUsersMp.set(user.id, user);
        }
        for (const group of newGroups) {
            newGroupsMp.set(group.id, group);
        }
        setAccounts(newAccountsMp);
        setUsers(newUsersMp);
        setGroups(newGroupsMp);
        setOrder(newOrder);
    }, []);
    useEffect(() => {
        update();
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => {
            update();
        }, { signal: abort.signal });
        const unload = subscribe("meta", () => update());
        return () => {
            abort.abort();
            unload();
        }
    }, [update]);
    if (!isValidElement(children)) throw new Error("MetaDataServer should have only one child.");
    return cloneElement(children, { accounts, users, groups, order, ...rest });
}