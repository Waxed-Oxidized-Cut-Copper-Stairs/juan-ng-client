// SPDX-License-Identifier: GPL-3.0-or-later

import { error } from "../shared/core";
import * as codeforces from "./platform/codeforces";
import { accountsDB, groupsDB, usersDB } from "./shared/ItemDB";

function activateMainloop() {
    codeforces.mainloop();
}

/** @param {Account} account */
function parseAccountId(account) { return `${account.platform}@${account.uid}`; }
/** @type {Map<string, string>} */
const accountIdMap = new Map();
const initAccountMap = (async () => {
    await accountsDB.init();
    const accounts = await accountsDB.getAll();
    for (const account of accounts) {
        accountIdMap.set(parseAccountId(account), account.id);
    }
})();

/**
 * 查询通过题号为 pid 的题目的账号
 * @param {string} pid
 * @returns {ProblemRecord}
 */
export async function queryPid(pid) {
    const passed = [];
    const submitted = [];
    const { passed: cfPassed, submitted: cfSubmitted } = await codeforces.queryPid(pid);
    for (const id of cfPassed) passed.push(id);
    for (const id of cfSubmitted) submitted.push(id);
    return { passed, submitted };
}

/**
 * 添加账号，返回含 id 的账号
 * 重复添加会自动合并
 * @param {Account} account
 * @param {boolean} [cover=false] false 表示继承 expire_at last_updated 和 name
 * @returns {Promise<Account>}
 */
export async function addAccount(account, cover = false) {
    if (typeof account.id !== "string") {
        await accountsDB.init();
        await initAccountMap;
        const uuid = parseAccountId(account);
        if (accountIdMap.has(uuid)) {
            account.id = accountIdMap.get(uuid);
            if (!cover) {
                const old = await accountsDB.get(account.id);
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
    activateMainloop();
    return account;
}
/**
 * 按 id 删除账号
 * @param {string} id
 */
export async function deleteAccount(id) {
    ;
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
 * 更新用户信息，如果用户不存在则创建
 * 判断用户是否存在的依据是 user.id 是否设置
 * @param {User} user
 * @returns {Promise<User>}
 */
export async function updateUser(user) {
    if (typeof user.id !== "string") {
        await usersDB.init();
        user.id = usersDB.generate();
        await usersDB.syncmeta();
    }
    await usersDB.set(user.id, user);
    return user;
}
/**
 * 按 id 删除用户
 * @param {string} id
 */
export async function deleteUser(id) {
    ;
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
 * @param {Group} group
 * @returns {Promise<Group>}
 */
export async function updateGroup(group) {
    if (typeof group.id !== "string") {
        await groupsDB.init();
        group.id = groupsDB.generate();
        await groupsDB.syncmeta();
    }
    await groupsDB.set(group.id, group);
    return group;
}
/**
 * 按 id 删除分组
 * @param {string} id
 */
export async function deleteGroup(id) {
    ;
}
/**
 * 获取用户列表
 * @returns {Promise<Group[]>}
 */
export async function getGroupList() {
    await groupsDB.init();
    return await groupsDB.getAll();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "sw") return;
    /** @type {(promise: Promise, name: string) => Promise<void>} */
    const wrapper = (promise, name) => {
        promise.then(sendResponse, err => {
            error(`service-worker.${name}`, err);
            sendResponse(null);
        });
    };
    switch (type) {
        case "query-pid": {
            wrapper(queryPid(...data), "queryPid");
            return true;
        }
        case "add-account": {
            wrapper(addAccount(...data), "addAccount");
            return true;
        }
        case "delete-account": {
            wrapper(deleteAccount(...data), "deleteAccount");
            return true;
        }
        case "get-account-list": {
            wrapper(getAccountList(...data), "getAccountList");
            return true;
        }
        case "update-user": {
            wrapper(updateUser(...data), "updateUser");
            return true;
        }
        case "delete-user": {
            wrapper(deleteUser(...data), "deleteUser");
            return true;
        }
        case "get-user-list": {
            wrapper(getUserList(...data), "getUserList");
            return true;
        }
        case "update-group": {
            wrapper(updateGroup(...data), "updateGroup");
            return true;
        }
        case "delete-group": {
            wrapper(deleteGroup(...data), "deleteGroup");
            return true;
        }
        case "get-group-list": {
            wrapper(getGroupList(...data), "getGroupList");
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
