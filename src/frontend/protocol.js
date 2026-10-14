// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @param {Promise<any>} promise
 * @param {string} name
 */
async function wrapper(promise, name) {
    try {
        return await promise;
    } catch { err } {
        error(`protocol.${name}`, err);
        return null;
    }
}

/** @type {typeof import("../backend/service-worker").queryPid} */
async function queryPid(pid) {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "query-pid", data: [pid] }), "queryPid");
}

/** @type {typeof import("../backend/service-worker").addAccount} */
async function addAccount(account) {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "add-account", data: [account] }), "addAccount");
}
/** @type {typeof import("../backend/service-worker").deleteAccount} */
async function deleteAccount(id) {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "delete-account", data: [id] }), "deleteAccount");
}
/** @type {typeof import("../backend/service-worker").getAccountList} */
async function getAccountList() {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "get-account-list", data: [] }), "getAccountList");
}

/** @type {typeof import("../backend/service-worker").updateUser} */
async function updateUser(user) {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "update-user", data: [user] }), "updateUser");
}
/** @type {typeof import("../backend/service-worker").deleteUser} */
async function deleteUser(id) {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "delete-user", data: [id] }), "deleteUser");
}
/** @type {typeof import("../backend/service-worker").getUserList} */
async function getUserList() {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "get-user-list", data: [] }), "getUserList");
}

/** @type {typeof import("../backend/service-worker").updateGroup} */
async function updateGroup(group) {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "update-group", data: [group] }), "updateGroup");
}
/** @type {typeof import("../backend/service-worker").deleteGroup} */
async function deleteGroup(id) {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "delete-group", data: [id] }), "deleteGroup");
}
/** @type {typeof import("../backend/service-worker").getGroupList} */
async function getGroupList() {
    return wrapper(chrome.runtime.sendMessage({ dst: "sw", type: "get-group-list", data: [] }), "getGroupList");
}

export { queryPid, addAccount, deleteAccount, getAccountList, updateUser, deleteUser, getUserList, updateGroup, deleteGroup, getGroupList };
