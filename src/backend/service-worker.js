// SPDX-License-Identifier: GPL-3.0-or-later

import { error } from "../shared/core";
import { mainloop as cfMainloop } from "./platform/codeforces";
import { accountsDB } from "./shared/ItemDB";

function activateMainloop() {
    cfMainloop();
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
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    chrome.tabs.sendMessage(details.tabId, { dst: "tab", type: "route" }).catch(err => error("service-worker.navigation", err));
});

activateMainloop();

console.log("Service Worker Loaded >w<");
