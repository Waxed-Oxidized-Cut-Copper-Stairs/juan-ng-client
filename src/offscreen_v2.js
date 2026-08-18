console.log("离屏页面 >w<");

import { sleep } from "../public/lib/asyncio.js";
import { error } from "../public/lib/core.js";
import { CacheDB } from "../public/lib/database.js";
import { randint } from "../public/lib/random.js";

const proxyURL = "http://127.0.0.1:6969";
console.log(`服务端地址 ${proxyURL}`);

const CODEFORCES_PROBLEMSET_GAP = 7 * 24 * 60 * 60 * 1000;
const FETCH_ERROR_GAP = 12 * 60 * 60 * 1000;
const CLIENT_ERROR_GAP = 12 * 60 * 60 * 1000;
const SERVER_ERROR_GAP = 6 * 60 * 60 * 1000;
const INTERNAL_ERROR_GAP = 12 * 60 * 60 * 1000;

const tempListener = (message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "offscreen") return;
    switch (type) {
        case "is-ready":
            sendResponse(false);
            break;
        default: {
            error("Offscreen 无法识别的消息", message);
            break;
        }
    }
};
chrome.runtime.onMessage.addListener(tempListener);

/** @type {Group[]}} */
const users = await (async () => {
    const resp = await fetch(`${proxyURL}/data`);
    if (!resp.ok) {
        throw new Error("无法获取数据，请检查服务端是否正常启动 :(");
    }
    return await resp.json();
})();
const lgUIDs = [];
const cfHandles = [];
/** @type {Map<string, number>} */
const cfHandleMap = new Map();
for (const user of users) {
    for (const account of user.accounts) {
        lgUIDs.push(account.luogu);
        if (account.cf) {
            cfHandles.push(account.cf);
            cfHandleMap.set(account.cf, account.luogu);
        }
    }
}

const luoguDB = new CacheDB("Luogu");
const atcoderDB = new CacheDB("AtCoder");
const codeforcesDB = new CacheDB("CodeForces");
await Promise.allSettled([luoguDB.init, atcoderDB.init, codeforcesDB.init]);

function luoguKey(uid) { return `${uid}`; }
function codeforcesKey(handle) { return `${handle}.status`; }

/** @type {Object<number, LuoguProfileNew>} */
let profiles = {};

class PidToUid {
    constructor() {
        /** @type {Map<string, Set<number>>} */
        this.mp = new Map();
    }
    ensure(pid) {
        if (this.mp.has(pid)) return;
        this.mp.set(pid, new Set());
    }
    add(pid, uid) {
        this.ensure(pid);
        this.mp.get(pid).add(uid);
    }
    del(pid, uid) {
        if (!this.mp.has(pid)) return;
        const st = this.mp.get(pid);
        st.delete(uid);
        if (!st.size) this.mp.delete(pid);
    }
    get(pid) {
        if (!this.mp.has(pid)) return null;
        return this.mp.get(pid);
    }
};
const passedMap = new PidToUid();
const submittedMap = new PidToUid();
/**
 * @param {string} pid
 * @param {number} uid
 */
function addPassed(pid, uid) {
    submittedMap.del(pid, uid);
    passedMap.add(pid, uid);
}
/**
 * @param {string} pid
 * @param {number} uid
 */
function addSubmitted(pid, uid) {
    if (passedMap.get(pid)?.has(uid)) return;
    submittedMap.add(pid, uid);
}
/**
 * @param {number} uid
 * @param {LuoguPracticeNew} practice
 */
function addLGPractice(uid, practice) {
    const { passed, submitted, name, privacy } = practice;
    for (const prob of submitted) addSubmitted(prob.pid, uid);
    for (const prob of passed) addPassed(prob.pid, uid);
    profiles[uid] = { name, privacy };
}
/**
 * @param {string} handle
 * @param {CodeForcesPractice} practice
 */
function addCFPractice(handle, practice) {
    const { passed, submitted } = practice;
    const uid = parseUid(handle);
    for (const prob of submitted) {
        const p = parseCodeforcesProblem(prob);
        if (p) addSubmitted(parsePid(p), uid);
    }
    for (const prob of passed) {
        const p = parseCodeforcesProblem(prob);
        if (p) addPassed(parsePid(p), uid);
    }
}

/**
 * @param {string} url
 * @param {string | null} key
 * @param {CacheDB | null} db
 */
async function fetchAPI(url, key = null, db = null) {
    console.log("fetchAPI", url);
    let resp;
    try {
        resp = await fetch(url);
    } catch (err) {
        send("notify", { title: "联考水表机 后端错误", msg: `请求 ${url} 出现错误 ${err}` });
        error(err, `请求 ${url} 时出现此错误`);
        if (key && db) await db.setExpiration(key, Date.now() + FETCH_ERROR_GAP);
        return;
    }
    if (!resp.ok) {
        error(`请求 ${url} 返回 ${resp.status} ${resp.statusText}`);
        if (400 <= resp.status && resp.status < 500) {
            if (key && db) await db.setExpiration(key, Date.now() + CLIENT_ERROR_GAP);
        } else if (500 <= resp.status && resp.status < 600) {
            if (key && db) await db.setExpiration(key, Date.now() + SERVER_ERROR_GAP);
        } else {
            if (key && db) await db.setExpiration(key, Date.now() + FETCH_ERROR_GAP);
        }
        return;
    }
    return await resp.json();
}

let luoguLock = Promise.resolve();
/**
 * @param {number} uid
 * @param {number | null} duration
 */
async function crawlLuogu(uid, duration = null) {
    const key = luoguKey(uid);
    const nxt = luoguLock.then(async () => {
        const url = `https://www.luogu.com.cn/user/${uid}/practice`;
        console.log("fetchProxy", url);
        let resp;
        try {
            resp = await fetch(new URL("proxy", proxyURL), { headers: { "x-target-url": url } });
        } catch (err) {
            send("notify", { title: "联考水表机 后端错误", msg: `通过代理服务器请求 ${url} 出现错误 ${err}` });
            error(err, `通过代理服务器请求 ${url} 时出现此错误`);
            await luoguDB.setExpiration(key, Date.now() + FETCH_ERROR_GAP);
            return;
        }
        if (!resp.ok) {
            error(`通过代理服务器请求 ${url} 返回 ${resp.status} ${resp.statusText}`);
            if (400 <= resp.status && resp.status < 500) {
                await luoguDB.setExpiration(key, Date.now() + CLIENT_ERROR_GAP);
            } else if (500 <= resp.status && resp.status < 600) {
                await luoguDB.setExpiration(key, Date.now() + SERVER_ERROR_GAP);
            } else {
                await luoguDB.setExpiration(key, Date.now() + FETCH_ERROR_GAP);
            }
            return;
        }
        return await resp.text();
    });
    luoguLock = nxt.then(() => sleep(randint(5000, 8000))).catch(() => { });
    const data = await nxt;
    if (!data) return;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, "text/html");
        const content = JSON.parse(doc.getElementById("lentille-context").textContent);
        const { passed, submitted, user, privacy } = content.data;
        /** @type {LuoguPracticeNew} */
        const ret = {
            passed, submitted,
            name: user.name,
            privacy: privacy ?? false
        }
        addLGPractice(uid, ret);
        await luoguDB.set(key, ret, duration ? Date.now() + duration : null);
    } catch (err) {
        error(err);
        await luoguDB.setExpiration(key, Date.now() + INTERNAL_ERROR_GAP);
    }
}

/** @param {CodeForcesProblemBrief} prob */
function parseCodeforcesProblem(prob) {
    const a = codeforcesProblemset.get(prob.name);
    if (!a) return null;
    for (const p of a) {
        if (Math.abs(p.contestId - prob.contestId) <= 1) return p;
    }
    return null;
}
/** @param {CodeForcesProblemBrief} prob */
function parsePid(prob) { return `CF${prob.contestId}${prob.index}`; }
/** @param {string} handle*/
function parseUid(handle) { return cfHandleMap.get(handle); }

let codeforcesLock = Promise.resolve();
/** @type {Map<string, CodeForcesProblem[]>} */
let codeforcesProblemset = new Map();
let codeforcesProblemsetLastUpdate = 0;
async function updateCodeforcesProblemset() {
    if (Date.now() - codeforcesProblemsetLastUpdate < CODEFORCES_PROBLEMSET_GAP) return;
    const nxt = codeforcesLock.then(async () => {
        const url = "https://codeforces.com/api/problemset.problems";
        return await fetchAPI(url);
    });
    codeforcesLock = nxt.then(() => sleep(2026)).catch(() => { });
    const data = await nxt;
    if (!data) return;
    try {
        /** @type {CodeForcesProblem[]} */
        const problems = data.result.problems;
        codeforcesProblemset.clear();
        for (const prob of problems) {
            if (!codeforcesProblemset.has(prob.name)) {
                codeforcesProblemset.set(prob.name, []);
            }
            codeforcesProblemset.get(prob.name).push(prob);
        }
        codeforcesProblemsetLastUpdate = Date.now();
        for (const handle of cfHandles) {
            /** @type {CodeForcesPractice} */
            const data = await codeforcesDB.get(codeforcesKey(handle));
            if (!data) continue;
            addCFPractice(handle, data);
        }
    } catch (err) {
        error(err);
        codeforcesProblemsetLastUpdate = Date.now() - CODEFORCES_PROBLEMSET_GAP + INTERNAL_ERROR_GAP;
    }
}
/**
 * @param {string} handle
 * @param {number | null} duration
 */
async function crawlCodeforces(handle, duration = null) {
    const key = `${handle}.status`;
    const nxt = codeforcesLock.then(async () => {
        const url = `https://codeforces.com/api/user.status?handle=${handle}&lang=en`;
        return await fetchAPI(url, key, codeforcesDB);
    });
    // Codeforces API 限制 2s/req
    codeforcesLock = nxt.then(() => sleep(2026)).catch(() => { });
    const data = await nxt;
    if (!data) return;
    try {
        /** @type {CodeForcesSubmission[]} */
        const submissions = data.result;
        const lastUpdate = submissions[0]?.creationTimeSeconds ?? 0;
        /** @type {CodeForcesProblemBrief[]} */
        const passed = [];
        /** @type {CodeForcesProblemBrief[]} */
        const submitted = [];
        for (const submission of submissions) {
            // 假定存在 contestId
            const contestId = submission.problem.contestId;
            const index = submission.problem.index;
            const name = submission.problem.name;
            const verdict = submission.verdict;
            if (verdict === "OK") {
                passed.push({ contestId, index, name });
            } else {
                submitted.push({ contestId, index, name });
            }
        }
        /** @type {CodeForcesPractice} */
        const ret = { passed, submitted, lastUpdate };
        addCFPractice(handle, ret);
        await codeforcesDB.set(key, ret, duration ? Date.now() + duration : null);
    } catch (err) {
        error(err);
        await codeforcesDB.setExpiration(key, Date.now() + INTERNAL_ERROR_GAP);
    }
}

function send(type, data) {
    chrome.runtime.sendMessage({ "dst": "sw", type, data });
}

let lgDone = 0;
let cfDone = 0;
let lasLgDone = 0;
let lasCfDone = 0;
function checkProgress() {
    if (lgDone == lasLgDone && cfDone == lasCfDone) return;
    lasLgDone = lgDone;
    lasCfDone = cfDone;
    send("route-to-active-tabs", { type: "progress", data: { done: lgDone + cfDone, total: lgUIDs.length + cfHandles.length } });
    send("route-to-active-tabs", { type: "configured" });
}
async function flushCache() {
    await luoguDB.expireAll();
    await codeforcesDB.expireAll();
}
/** @param {Account[]} accounts */
async function flushSpecificCache(accounts) {
    for (const account of accounts) {
        await luoguDB.expire(luoguKey(account.luogu));
        if (account.cf) await codeforcesDB.expire(codeforcesKey(account.cf));
    }
}
async function clearCache() {
    await luoguDB.clear();
    await codeforcesDB.clear();
}

let mainloopActive = false;
async function mainloop() {
    if (mainloopActive) return;
    mainloopActive = true;
    try {
        const promises = [];
        lgDone = 0;
        cfDone = 0;
        promises.push(updateCodeforcesProblemset());
        for (const uid of lgUIDs) {
            if (await luoguDB.satisfied(luoguKey(uid))) {
                ++lgDone;
            } else {
                promises.push(crawlLuogu(uid)
                    .catch(err => {
                        error(err);
                    }).finally(() => {
                        ++lgDone;
                        checkProgress();
                    }));
            }
        }
        for (const handle of cfHandles) {
            if (await codeforcesDB.satisfied(codeforcesKey(handle))) {
                ++cfDone;
            } else {
                promises.push(crawlCodeforces(handle)
                    .catch(err => {
                        error(err);
                    }).finally(() => {
                        ++cfDone;
                        checkProgress();
                    }));
            }
        }
        checkProgress();
        await Promise.allSettled(promises);
    } finally {
        mainloopActive = false;
    }
}

for (const uid of lgUIDs) {
    /** @type {LuoguPracticeNew} */
    const data = await luoguDB.get(luoguKey(uid));
    if (!data) continue;
    addLGPractice(uid, data);
}

chrome.runtime.onMessage.removeListener(tempListener);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "offscreen") return;
    mainloop();
    switch (type) {
        case "query-users":
            sendResponse(users);
            break;
        case "query-pid":
            sendResponse({
                passed: Array.from(passedMap.get(data) ?? []),
                submitted: Array.from(submittedMap.get(data) ?? [])
            })
            break;
        case "query-profile":
            sendResponse(profiles[data]);
            break;
        case "query-progress":
            sendResponse({ done: lasLgDone + lasCfDone, total: lgUIDs.length + cfHandles.length });
            break;
        case "flush-cache":
            flushCache();
            break;
        case "flush-specific-cache":
            flushSpecificCache(data);
            break;
        case "clear-cache":
            clearCache();
            break;
        case "is-ready":
            chrome.runtime.sendMessage({ dst: "sw", type: "offscreen-ready" });
            break;
        default: {
            error("Offscreen 无法识别的消息", message);
            break;
        }
    }
});
chrome.runtime.sendMessage({ dst: "sw", type: "offscreen-ready" });
mainloop();