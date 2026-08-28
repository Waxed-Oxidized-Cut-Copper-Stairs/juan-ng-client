// SPDX-License-Identifier: GPL-3.0-or-later

/*
protocol_v2.js

前端与 Service Worker 通信的模块。
*/

import { Lock, sleep } from "./lib/asyncio.js";
import { error } from "./lib/core.js";

export function ping() {
    try {
        const ret = chrome.runtime && chrome.runtime.id !== undefined;
        if (!ret) emit("outdate");
        return ret;
    } catch (err) {
        emit("outdate");
        return false;
    }
}

/** @param {() => Promise} fn */
async function errorWrapper(fn) {
    try {
        return await fn();
    } catch (err) {
        if (ping()) throw err;
        error(err, "已忽略此异常");
        return null;
    };
}
/**
 * @param {Promise} promise
 * @param {number} timeout
 */
async function timeoutWrapper(promise, timeout = 3000) {
    return Promise.race([promise, sleep(timeout).then(() => null)]);
}

/**
 * @param {string} pid
 * @returns {Promise<{ passed: number[], submitted: number[] }>}
 */
async function acquireProblem(pid) {
    return timeoutWrapper(errorWrapper(() => chrome.runtime.sendMessage({ dst: "sw", type: "query-pid", data: pid })));
}

const originLock = new Lock();
/** @type {Map<string, { passed: Map<number, [string, string | number]>, submitted: Map<number, [string, string | number]> }>} */
const cachedOrigins = new Map();
/**
 * @param {string} pid
 * @param {boolean} [force=false]
 * @returns {Promise<{ passed: Map<number, [string, string | number]>, submitted: Map<number, [string, string | number]> }>}
 */
async function acquireOrigin(pid, force = false) {
    if (!force && cachedOrigins.has(pid)) return cachedOrigins.get(pid);
    await originLock.acquire();
    try {
        if (!force && cachedOrigins.has(pid)) return cachedOrigins.get(pid);
        return timeoutWrapper(errorWrapper(() => chrome.runtime.sendMessage({ dst: "sw", type: "query-origin", data: pid }))).then(ret => {
            const dt = {
                passed: new Map(ret.passed),
                submitted: new Map(ret.submitted)
            };
            cachedOrigins.set(pid, dt);
            return dt;
        });
    } finally {
        originLock.release();
    }
}

/** @type {Map<number, LuoguProfileNew>} */
const cachedProfiles = new Map();
/**
 * @param {number} uid 
 * @returns {Promise<LuoguProfileNew | null>}
 */
async function acquireUserProfile(uid) {
    if (cachedProfiles.has(uid)) return cachedProfiles.get(uid);
    return timeoutWrapper(errorWrapper(() => chrome.runtime.sendMessage({ dst: "sw", type: "query-profile", data: uid }))).then(ret => {
        if (!ret) return null;
        cachedProfiles.set(uid, ret);
        return ret;
    });
}

/** @returns {Promise<{ done: number, total: number } | null>} */
async function acquireProgress() {
    return timeoutWrapper(errorWrapper(() => chrome.runtime.sendMessage({ dst: "sw", type: "query-progress" })));
}

let cachedUID = null;
let cachedUIDLastUpdate = 0;
/** @returns {Promise<number | null>} */
async function acquireUID() {
    if (cachedUID !== null && cachedUIDLastUpdate + 60 * 1000 > Date.now()) return cachedUID;
    return timeoutWrapper(errorWrapper(() => chrome.runtime.sendMessage({ dst: "sw", type: "query-uid" }))).then(ret => {
        cachedUID = ret;
        cachedUIDLastUpdate = Date.now();
        return ret;
    });
}

/** @param {Domain[]} [domains=null] */
export function flushCache(domains = null) {
    cachedProfiles.clear();
    errorWrapper(() => chrome.runtime.sendMessage({ dst: "sw", type: "flush-cache", data: domains }));
}
/**
 * @param {Account[]} accounts
 * @param {Domain[]} [domains=null]
 */
export function flushSpecificCache(accounts, domains = null) {
    if (domains && domains.includes("lg")) {
        for (const account of accounts) {
            cachedProfiles.delete(account.luogu);
        }
    }
    errorWrapper(() => chrome.runtime.sendMessage({ dst: "sw", type: "flush-specific-cache", data: { accounts, domains } }));
}

/** @type {Map<string, Set<(data: any) => void>>} */
const subscription = new Map();
/**
 * 订阅一个事件，当事件触发时调用回调函数
 * problem, progress: 题目数据变化时由 offscreen 触发，目前实现为一起触发
 * profile, profile-<uid>: 用户洛谷账户信息改变时由 offscreen 触发，可以使用 <uid> 指定特定账户信息改变时才触发
 * route: 当前页面导航时由 service worker 触发，无论页面是否处于 active 状态
 * outdate: protocol 发现当前页面扩展状态过期时触发
 * @param {"problem" | "progress" | "profile" | "profile-<uid>" | "route" | "outdate"} type
 * @param {(data: any) => void} callback
 */
export function subscribe(type, callback) {
    if (!subscription.has(type)) subscription.set(type, new Set());
    const set = subscription.get(type);
    set.add(callback);
    return () => {
        set.delete(callback);
        if (!set.size) subscription.delete(type);
    }
}
/** @param {"problem" | "progress" | "profile" | "route" | "outdate"} type */
function emit(type, data) {
    if (!subscription.has(type)) return;
    if (type === "profile") {
        for (const uid of data) {
            for (const callback of (subscription.get(`profile-${uid}`) ?? [])) {
                callback(uid);
            }
        }
    }
    for (const callback of (subscription.get(type) ?? [])) {
        callback(data);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, data } = message;
    switch (type) {
        case "configured":
            cachedOrigins.clear();
            emit("problem", data);
            break;
        case "progress":
            emit("progress", data);
            break;
        case "profile":
            emit("profile", data);
            break;
        case "route":
            emit("route", data);
            break;
        default: {
            error("Protocol 无法识别的消息", message);
            break;
        }
    }
});

export { acquireProblem, acquireOrigin, acquireUserProfile, acquireProgress, acquireUID }