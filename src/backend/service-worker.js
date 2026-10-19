// SPDX-License-Identifier: GPL-3.0-or-later

import { Lock, throttle } from "../shared/asyncio";
import { error } from "../shared/core";
import * as codeforces from "./platform/codeforces";
import { accountsDB, groupsDB, usersDB } from "./shared/ItemDB";

function activateMainloop() {
    codeforces.mainloop();
}

/**
 * @param {Account} account
 * @returns {DisplayID}
 */
function parseAccountId(account) { return /** @type {DisplayID} */(`${account.platform}@${account.uid}`); }
/** @type {Map<DisplayID, InternalID>} */
const accountIdMap = new Map();
const initAccountMap = (async () => {
    await accountsDB.init();
    const accounts = await accountsDB.getAll();
    for (const account of accounts) {
        accountIdMap.set(parseAccountId(account), account.id);
    }
})();

function sendToActiveTabs(payload) {
    chrome.tabs.query({
        active: true,
        url: [
            "https://www.luogu.com.cn/*",
            "https://www.luogu.me/*"
        ]
    }).then(tabs => {
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, payload).catch(err => null);
        }
        chrome.runtime.sendMessage(payload).catch(err => null);
    }).catch(err => null);
}
const emitMetaChange = throttle(() => {
    sendToActiveTabs({ dst: "tab", type: "meta-change" });
}, 20);
const emitDataChange = throttle(() => {
    sendToActiveTabs({ dst: "tab", type: "data-change" });
}, 100);

/**
 * 查询通过题号为 pid 的题目的账号
 * @param {PID} pid
 * @returns {Promise<ProblemRecord>}
 */
export async function queryPid(pid) {
    const passed = [];
    const submitted = [];
    const { passed: cfPassed, submitted: cfSubmitted } = await codeforces.queryPid(pid);
    for (const id of cfPassed) passed.push(id);
    for (const id of cfSubmitted) submitted.push(id);
    return { passed, submitted };
}

const writeLock = new Lock();

/**
 * 添加账号，返回含 id 的账号
 * 重复添加会自动合并
 * @note 此函数有全局写锁（不可重入）
 * @param {Account} account
 * @param {boolean} [cover=false] false 表示继承 expire_at last_updated 和 name
 * @returns {Promise<Account>}
 */
export async function addAccount(account, cover = false) {
    await writeLock.acquire();
    try {
        if (typeof account.id !== "string") {
            await accountsDB.init();
            await initAccountMap;
            const uuid = parseAccountId(account);
            if (accountIdMap.has(uuid)) {
                account.id = /** @type {InternalID} */(accountIdMap.get(uuid));
                if (!cover) {
                    const old = /** @type {Account} */(await accountsDB.get(account.id));
                    account.expire_at = old.expire_at;
                    account.last_updated = old.last_updated;
                    account.name = old.name;
                }
            } else {
                account.id = accountsDB.generate();
                accountIdMap.set(uuid, account.id);
                await accountsDB.syncmeta();
            }
        }
        await accountsDB.set(account.id, account);
        emitMetaChange();
        activateMainloop();
        return account;
    } finally {
        writeLock.release();
    }
}
/**
 * 按 id 删除账号，同时删除用户的所有引用，以及缓存的数据
 * @note 此函数有全局写锁（不可重入）
 * @param {string} id
 */
export async function deleteAccount(id) {
    await writeLock.acquire();
    try {
        ;
    } finally {
        writeLock.release();
    }
}
/**
 * 获取账号列表
 * @returns {Promise<Account[]>}
 */
export async function getAccountList() {
    await accountsDB.init();
    return await accountsDB.getAll();
}

/**
 * @param {User} user
 * @returns {Promise<User>}
 */
async function _updateUser(user) {
    if (typeof user.id !== "string") {
        await usersDB.init();
        user.id = usersDB.generate();
        await usersDB.syncmeta();
    }
    await usersDB.set(user.id, user);
    emitMetaChange();
    return user;
}
/**
 * 更新用户信息，如果用户不存在则创建
 * 判断用户是否存在的依据是 user.id 是否设置
 * @note 此函数有全局写锁（不可重入）
 * @param {User} user
 * @returns {Promise<User>}
 */
export async function updateUser(user) {
    await writeLock.acquire();
    try {
        return await _updateUser(user);
    } finally {
        writeLock.release();
    }
}
/**
 * updateUser 的封装，用于原子地添加用户和附加到分组上
 * @note 此函数有全局写锁（不可重入）
 * @param {User} user
 * @param {InternalID} groupId
 * @returns {Promise<User>}
 */
export async function attachUser(user, groupId) {
    await writeLock.acquire();
    try {
        const ret = await _updateUser(user);
        await groupsDB.init();
        const group = await groupsDB.get(groupId);
        if (!group.members.includes(ret.id)) {
            group.members.push(ret.id);
            await groupsDB.set(groupId, group);
        }
        return ret;
    } finally {
        writeLock.release();
    }
}
/**
 * 按 id 删除用户，同时删除所有分组中的引用
 * @note 此函数有全局写锁（不可重入）
 * @param {string} id
 */
export async function deleteUser(id) {
    await writeLock.acquire();
    try {
        await groupsDB.init();
        const groups = await groupsDB.getAll();
        /** @type {[InternalID, Group][]} */
        const upd = [];
        for (const group of groups) {
            const idx = group.members.indexOf(id);
            if (idx !== -1) {
                group.members.splice(idx, 1);
                upd.push([group.id, group]);
            }
        }
        if (upd.length) await groupsDB.setMany(upd);
        await usersDB.init();
        await usersDB.del(id);
        emitMetaChange();
    } finally {
        writeLock.release();
    }
}
/**
 * 获取用户列表
 * @returns {Promise<User[]>}
 */
export async function getUserList() {
    await usersDB.init();
    return await usersDB.getAll();
}

/**
 * 更新分组信息，如果分组不存在则创建
 * 判断分组是否存在的依据是 group.id 是否设置
 * @note 此函数有全局写锁（不可重入）
 * @param {Group} group
 * @returns {Promise<Group>}
 */
export async function updateGroup(group) {
    await writeLock.acquire();
    try {
        if (typeof group.id !== "string") {
            await groupsDB.init();
            group.id = groupsDB.generate();
            await groupsDB.syncmeta();
            const order = await getGroupOrder();
            order.push(group.id);
            await _setGroupOrder(order);
        }
        await groupsDB.set(group.id, group);
        emitMetaChange();
        return group;
    } finally {
        writeLock.release();
    }
}
/**
 * 按 id 删除分组，同时删除它在 order 中的位置
 * @note 此函数有全局写锁（不可重入）
 * @param {string} id
 */
export async function deleteGroup(id) {
    await writeLock.acquire();
    try {
        const order = await getGroupOrder();
        await _setGroupOrder(order.filter((val) => val !== id));
        await groupsDB.init();
        await groupsDB.del(id);
        emitMetaChange();
    } finally {
        writeLock.release();
    }
}
/**
 * 获取分组列表
 * @returns {Promise<Group[]>}
 */
export async function getGroupList() {
    await groupsDB.init();
    return await groupsDB.getAll();
}

/**
 * 获取分组排列顺序
 * @returns {Promise<InternalID[]>}
 */
export async function getGroupOrder() {
    return (await chrome.storage.local.get(["order"])).order ?? [];
}
async function _setGroupOrder(order) {
    await chrome.storage.local.set({ order });
}
/**
 * 设置分组排列顺序
 * @param {InternalID[]} order
 */
export async function setGroupOrder(order) {
    await _setGroupOrder(order);
    emitMetaChange();
}

// @ts-ignore
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "sw") return;
    /** @type {(promise: Promise<any>, name: string) => Promise<void>} */
    const wrapper = (promise, name) => {
        return promise.then(sendResponse, err => {
            error(`service-worker.${name}`, err);
            sendResponse(null);
        });
    };
    switch (type) {
        case "query-pid": {
            // @ts-ignore
            wrapper(queryPid(...data), "queryPid");
            return true;
        }
        case "add-account": {
            // @ts-ignore
            wrapper(addAccount(...data), "addAccount");
            return true;
        }
        case "delete-account": {
            // @ts-ignore
            wrapper(deleteAccount(...data), "deleteAccount");
            return true;
        }
        case "get-account-list": {
            // @ts-ignore
            wrapper(getAccountList(...data), "getAccountList");
            return true;
        }
        case "update-user": {
            // @ts-ignore
            wrapper(updateUser(...data), "updateUser");
            return true;
        }
        case "attach-user": {
            // @ts-ignore
            wrapper(attachUser(...data), "attachUser");
            return true;
        }
        case "delete-user": {
            // @ts-ignore
            wrapper(deleteUser(...data), "deleteUser");
            return true;
        }
        case "get-user-list": {
            // @ts-ignore
            wrapper(getUserList(...data), "getUserList");
            return true;
        }
        case "update-group": {
            // @ts-ignore
            wrapper(updateGroup(...data), "updateGroup");
            return true;
        }
        case "delete-group": {
            // @ts-ignore
            wrapper(deleteGroup(...data), "deleteGroup");
            return true;
        }
        case "get-group-list": {
            // @ts-ignore
            wrapper(getGroupList(...data), "getGroupList");
            return true;
        }
        case "get-group-order": {
            wrapper(getGroupOrder(...data), "getGroupOrder");
            return true;
        }
        case "set-group-order": {
            wrapper(setGroupOrder(...data), "setGroupOrder");
            return true;
        }
        case "debug:expire-all": {
            wrapper((async () => {
                await accountsDB.init();
                const accounts = await accountsDB.getAll()
                const newAccounts = [];
                for (const account of accounts) {
                    account.expire_at = undefined;
                    account.last_updated = undefined;
                    newAccounts.push([account.id, account]);
                }
                // @ts-ignore
                await accountsDB.setMany(newAccounts);
            })(), "debug:expire-all");
            return true;
        }
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    chrome.tabs.sendMessage(details.tabId, { dst: "tab", type: "route" }).catch(err => error("service-worker.navigation", err));
});

activateMainloop();

console.log("Service Worker Loaded >w<");
