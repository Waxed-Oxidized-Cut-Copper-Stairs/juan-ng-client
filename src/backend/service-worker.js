// SPDX-License-Identifier: GPL-3.0-or-later

import { error } from "../shared/core";
import { accountsDB } from "./shared/ItemDB";

/**
 * 添加账号，返回含 id 的账号
 * @param {Account} account
 * @returns {Promise<Account>}
 */
async function addAccount(account) {
    if (typeof account.id !== "string") {
        await accountsDB.init();
        account.id = await accountsDB.generate();
    }
    await accountsDB.set(account.id, account);
    return account;
}
/**
 * 按 id 删除账号
 * @param {string} id
 */
async function deleteAccount(id) {
    ;
}
/**
 * 获取账号列表
 * @returns {Promise<Account[]>}
 */
async function getAccountList() {
    return await accountsDB.getAll();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "sw") return;
    switch (type) {
        case "add-account": {
            addAccount(...data).then(sendResponse, sendResponse);
            return true;
        }
        case "delete-account": {
            deleteAccount(...data).then(sendResponse, sendResponse);
            return true;
        }
        case "get-account-list": {
            getAccountList(...data).then(sendResponse, sendResponse);
            return true;
        }
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    chrome.tabs.sendMessage(details.tabId, { dst: "tab", type: "route" }).catch(err => error("service-worker.navigation", err));
});

console.log("Service Worker Loaded >w<");
