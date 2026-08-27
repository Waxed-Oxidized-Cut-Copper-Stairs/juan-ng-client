// SPDX-License-Identifier: GPL-3.0-or-later

console.log("离屏页面 >w<");

import { sleep } from "./lib/asyncio.js";
import { error, log } from "../public/lib/core.js";
import { CacheDB } from "./lib/database.js";
import { randint, shuffle } from "./lib/random.js";

const proxyURL = "http://127.0.0.1:6969";
log(`服务端地址 ${proxyURL}`);

const CODEFORCES_PROBLEMSET_GAP = 7 * 24 * 60 * 60 * 1000;
const FETCH_ERROR_GAP = 12 * 60 * 60 * 1000;
const CLIENT_ERROR_GAP = 12 * 60 * 60 * 1000;
const SERVER_ERROR_GAP = 6 * 60 * 60 * 1000;
const INTERNAL_ERROR_GAP = 12 * 60 * 60 * 1000;

const DURATION_LG_EASY = null;
const DURATION_LG_NORMAL = 7 * 24 * 60 * 60 * 1000;
const DURATION_LG_HARD = 3 * 24 * 60 * 60 * 1000;
const DURATION_LG_LUNATIC = 24 * 60 * 60 * 1000;
const DURATION_CF_EASY = 3 * 24 * 60 * 60 * 1000;
const DURATION_CF_NORMAL = 24 * 60 * 60 * 1000;
const DURATION_CF_HARD = 24 * 60 * 60 * 1000;
const DURATION_CF_LUNATIC = 6 * 60 * 60 * 1000;
const DURATION_AT_EASY = 3 * 24 * 60 * 60 * 1000;
const DURATION_AT_NORMAL = 24 * 60 * 60 * 1000;
const DURATION_AT_HARD = 24 * 60 * 60 * 1000;
const DURATION_AT_LUNATIC = 6 * 60 * 60 * 1000;

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
const atHandles = [];
/** @type {Map<string, number>} */
const cfHandleMap = new Map();
/** @type {Map<string, number>} */
const atHandleMap = new Map();
/** @type {Map<number, number>} */
const lgPriMap = new Map();
/** @type {Map<string, number>} */
const cfPriMap = new Map();
/** @type {Map<string, number>} */
const atPriMap = new Map();
for (const user of users) {
    for (const { luogu: uid, cf, at, pri } of user.accounts) {
        lgUIDs.push(uid);
        if (pri) lgPriMap.set(uid, pri);
        if (cf) {
            for (const handle of ((typeof cf === "string") ? [cf] : cf)) {
                cfHandles.push(handle);
                cfHandleMap.set(handle, uid);
                if (pri) cfPriMap.set(handle, pri);
            }
        }
        if (at) {
            for (const handle of ((typeof at === "string") ? [at] : at)) {
                atHandles.push(handle);
                atHandleMap.set(handle, uid);
                if (pri) atPriMap.set(handle, pri);
            }
        }
    }
}

/** @type {CacheDB<LuoguPracticeNew>} */
const luoguDB = new CacheDB("Luogu");
/** @type {CacheDB<CodeForcesPractice>} */
const codeforcesDB = new CacheDB("CodeForces");
/** @type {CacheDB<AtCoderPractice>} */
const atcoderDB = new CacheDB("AtCoder");
await Promise.allSettled([luoguDB.init, codeforcesDB.init, atcoderDB.init]);

function luoguKey(uid) { return `${uid}`; }
function codeforcesKey(handle) { return `${handle}.status`; }
function atcoderKey(handle) { return `${handle}.status`; }
function luoguDuration(uid) {
    const p = lgPriMap.get(uid);
    if (p >= 3) return DURATION_LG_LUNATIC;
    else if (p == 2) return DURATION_LG_HARD;
    else if (p == 1) return DURATION_LG_NORMAL;
    return DURATION_LG_EASY;
}
function codeforcesDuration(handle) {
    const p = cfPriMap.get(handle);
    if (p >= 3) return DURATION_CF_LUNATIC;
    else if (p == 2) return DURATION_CF_HARD;
    else if (p == 1) return DURATION_CF_NORMAL;
    return DURATION_CF_EASY;
}
function atcoderDuration(handle) {
    const p = atPriMap.get(handle);
    if (p >= 3) return DURATION_AT_LUNATIC;
    else if (p == 2) return DURATION_AT_HARD;
    else if (p == 1) return DURATION_AT_NORMAL;
    return DURATION_AT_EASY;
}

/** @type {Map<number, LuoguProfileNew>} */
const profiles = new Map();

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
    const old = profiles.get(uid);
    if (!profiles.has(uid) || old.name !== name || old.privacy !== privacy) {
        profiles.set(uid, { name, privacy });
        send("route-to-active-tabs", { type: "profile", data: [uid] });
    }
}
/**
 * @param {string} handle
 * @param {CodeForcesPractice} practice
 */
function addCFPractice(handle, practice) {
    const { passed, submitted } = practice;
    const uid = parseCFUid(handle);
    for (const prob of submitted) {
        addSubmitted(parseCodeforcesProblem(prob), uid);
    }
    for (const prob of passed) {
        addPassed(parseCodeforcesProblem(prob), uid);
    }
}
/**
 * @param {string} handle
 * @param {AtCoderPractice} practice
 */
function addATPractice(handle, practice) {
    const { passed, submitted } = practice;
    const uid = parseATUid(handle);
    for (const prob of submitted) {
        addSubmitted(parseATPid(prob), uid);
    }
    for (const prob of passed) {
        addPassed(parseATPid(prob), uid);
    }
}

/**
 * @param {string} url
 * @param {string | null} key
 * @param {CacheDB | null} db
 */
async function fetchAPI(url, key = null, db = null) {
    log(`fetchAPI ${url}`);
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

let luoguLock = sleep(60 * 1000);
/**
 * @param {number} uid
 * @param {number | null} duration
 */
async function crawlLuogu(uid, duration = null) {
    const key = luoguKey(uid);
    const nxt = luoguLock.then(async () => {
        const url = `https://www.luogu.com.cn/user/${uid}/practice`;
        log(`fetchProxy ${url}`);
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
    luoguLock = nxt.finally(() => sleep(randint(60 * 1000, 5 * 60 * 1000))).catch(() => { });
    const data = await nxt;
    if (!data) return;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, "text/html");
        const content = JSON.parse(doc.getElementById("lentille-context").textContent);
        const { passed, submitted, user, privacy } = content.data;
        /** @type {LuoguPracticeNew} */
        let ret;
        if (privacy) {
            ret = (await luoguDB.get(key)) ?? { passed: [], submitted: [] };
            ret.name = user.name;
            ret.privacy = privacy;
        } else {
            ret = {
                passed, submitted,
                name: user.name,
                privacy: privacy ?? false
            }
            addLGPractice(uid, ret);
        }
        await luoguDB.set(key, ret, duration !== null ? Date.now() + duration : null);
    } catch (err) {
        error(err);
        await luoguDB.setExpiration(key, Date.now() + INTERNAL_ERROR_GAP);
    }
}

/** @param {CodeForcesProblemBrief} prob */
function parseCodeforcesProblem(prob) {
    const a = codeforcesProblemset.get(prob.name);
    if (!a) return parseCFPid(prob);
    for (const p of a) {
        if (Math.abs(p.contestId - prob.contestId) <= 1) return parseCFPid(p);
    }
    return parseCFPid(prob);
}
/** @param {CodeForcesProblemBrief} prob */
function parseCFPid(prob) { return `CF${prob.contestId}${prob.index}`; }
/** @param {string} handle*/
function parseCFUid(handle) { return cfHandleMap.get(handle); }

let codeforcesLock = sleep(2026);
/** @type {Map<string, CodeForcesProblem[]>} */
let codeforcesProblemset = new Map();
let codeforcesProblemsetLastUpdate = 0;
async function updateCodeforcesProblemset() {
    if (Date.now() - codeforcesProblemsetLastUpdate < CODEFORCES_PROBLEMSET_GAP) return;
    const nxt = codeforcesLock.then(async () => {
        const url = "https://codeforces.com/api/problemset.problems";
        return await fetchAPI(url);
    });
    codeforcesLock = nxt.finally(() => sleep(2026)).catch(() => { });
    let data;
    try {
        data = await nxt;
    } catch (err) {
        codeforcesProblemsetLastUpdate = Date.now() - CODEFORCES_PROBLEMSET_GAP + INTERNAL_ERROR_GAP;
        throw err;
    }
    if (!data) {
        codeforcesProblemsetLastUpdate = Date.now() - CODEFORCES_PROBLEMSET_GAP + INTERNAL_ERROR_GAP;
        return;
    }
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
    const key = codeforcesKey(handle);
    const nxt = codeforcesLock.then(async () => {
        const url = `https://codeforces.com/api/user.status?handle=${handle}&lang=en`;
        return await fetchAPI(url, key, codeforcesDB);
    });
    // Codeforces API 限制 2s/req
    codeforcesLock = nxt.finally(() => sleep(2026)).catch(() => { });
    const data = await nxt;
    if (!data) return;
    try {
        /** @type {CodeForcesSubmission[]} */
        const submissions = data.result;
        const lastUpdate = submissions[0]?.creationTimeSeconds ?? 0;
        /** @type {Map<string, CodeForcesProblemBrief>} */
        const passed = new Map();
        /** @type {Map<string, CodeForcesProblemBrief>} */
        const submitted = new Map();
        for (const submission of submissions) {
            // 假定存在 contestId
            const contestId = submission.problem.contestId;
            const index = submission.problem.index;
            const name = submission.problem.name;
            const verdict = submission.verdict;
            const prob = { contestId, index, name };
            if (verdict === "OK") {
                passed.set(parseCFPid(prob), prob);
            } else {
                submitted.set(parseCFPid(prob), prob);
            }
        }
        /** @type {CodeForcesPractice} */
        const ret = {
            passed: Array.from(passed.values()),
            submitted: Array.from(submitted.values()),
            lastUpdate
        };
        addCFPractice(handle, ret);
        await codeforcesDB.set(key, ret, duration !== null ? Date.now() + duration : null);
    } catch (err) {
        error(err);
        await codeforcesDB.setExpiration(key, Date.now() + INTERNAL_ERROR_GAP);
    }
}

/** @param {string} prob */
function parseATPid(prob) { return `AT_${prob}`; }
/** @param {string} handle */
function parseATUid(handle) { return atHandleMap.get(handle); }

let atcoderLock = sleep(1024);
/**
 * @param {string} handle
 * @param {number | null} duration
 */
async function crawlAtcoder(handle, duration = null) {
    const key = atcoderKey(handle);
    let fetchBroken = false;
    const nxt = atcoderLock.then(async () => {
        const expiration = await atcoderDB.getExpiration(key);
        const history = expiration === 0 ? {} : await atcoderDB.get(key);
        let last = history?.lastSubmission ?? 0;
        /** @type {Set<string>} */
        const passed = new Set(history?.passed ?? []);
        /** @type {Set<string>} */
        const submitted = new Set(history?.submitted ?? []);
        while (true) {
            // 如果同一秒内有多次提交，可能会遗漏
            // 这种可能性比较小，尤其是在 AT 启用 Cloudflare 之后，所以不管
            const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${handle}&from_second=${last}`;
            /** @type {AtCoderSubmission[]} */
            try {
                const data = await fetchAPI(url, key, atcoderDB);
                if (!data) {
                    fetchBroken = true;
                    break;
                }
                for (const submission of data) {
                    if (submission.result === "AC") passed.add(submission.problem_id);
                    else submitted.add(submission.problem_id);
                    last = submission.epoch_second + 1;
                }
                if (data.length < 500) break;
                await sleep(1024);
            } catch (err) {
                error(err);
                break;
            }
        }
        return {
            passed: Array.from(passed),
            submitted: Array.from(submitted),
            lastSubmission: last
        };
    });
    // Kenkoooo API 限制 1s/req
    atcoderLock = nxt.finally(() => sleep(1024)).catch(() => { });
    /** @type {AtCoderPractice} */
    const data = await nxt;
    if (!data) return;
    addATPractice(handle, data);
    if (fetchBroken) {
        await atcoderDB.setData(key, data);
    } else {
        await atcoderDB.set(key, data, duration !== null ? Date.now() + duration : null);
    }
}

function send(type, data) {
    chrome.runtime.sendMessage({ "dst": "sw", type, data });
}

let lgDone = 0;
let cfDone = 0;
let atDone = 0;
let lasLgDone = 0;
let lasCfDone = 0;
let lasAtDone = 0;
function checkProgress() {
    if (lgDone == lasLgDone && cfDone == lasCfDone && atDone == lasAtDone) return;
    lasLgDone = lgDone;
    lasCfDone = cfDone;
    lasAtDone = atDone;
    send("route-to-active-tabs", { type: "progress", data: { done: lgDone + cfDone + atDone, total: lgUIDs.length + cfHandles.length + atHandles.length } });
    send("route-to-active-tabs", { type: "configured" });
}
/** @param {Domain[]} [domains=null] */
async function flushCache(domains = null) {
    if (!domains) domains = ["lg", "cf", "at"];
    if (domains.includes("lg")) await luoguDB.expireAll();
    if (domains.includes("cf")) await codeforcesDB.expireAll();
    if (domains.includes("at")) await atcoderDB.expireAll();
}
/**
 * @param {Account[]} accounts
 * @param {Domain[]} [domains=null]
 */
async function flushSpecificCache(accounts, domains = null) {
    if (!domains) domains = ["lg", "cf", "at"];
    for (const { luogu: uid, cf, at } of accounts) {
        if (domains.includes("lg")) await luoguDB.expire(luoguKey(uid));
        if (domains.includes("cf") && cf) {
            for (const handle of (Array.isArray(cf) ? cf : [cf])) {
                await codeforcesDB.expire(codeforcesKey(handle));
            }
        }
        if (domains.includes("at") && at) {
            for (const handle of (Array.isArray(at) ? at : [at])) {
                await atcoderDB.expire(atcoderKey(handle));
            }
        }
    }
}

async function initialize() {
    for (const uid of lgUIDs) {
        try {
            /** @type {LuoguPracticeNew} */
            const data = await luoguDB.get(luoguKey(uid));
            if (!data) continue;
            addLGPractice(uid, data);
        } catch (err) {
            error(err);
        }
    }
    for (const handle of cfHandles) {
        try {
            /** @type {CodeForcesPractice} */
            const data = await codeforcesDB.get(codeforcesKey(handle));
            if (!data) continue;
            addCFPractice(handle, data);
        } catch (err) {
            error(err);
        }
    }
    for (const handle of atHandles) {
        try {
            /** @type {AtCoderPractice} */
            const data = await atcoderDB.get(atcoderKey(handle));
            if (!data) continue;
            addATPractice(handle, data);
        } catch (err) {
            error(err);
        }
    }
}

let mainloopActive = false;
async function mainloop() {
    if (mainloopActive) return;
    mainloopActive = true;
    try {
        const promises = [];
        lgDone = 0;
        cfDone = 0;
        atDone = 0;
        promises.push(updateCodeforcesProblemset());
        const lg = [];
        for (const uid of lgUIDs) {
            let ex = await luoguDB.getExpiration(luoguKey(uid));
            const d = luoguDuration(uid);
            // 处理 pri 变化
            if (ex === null && d) {
                await luoguDB.expire(luoguKey(uid));
                ex = 0;
            }
            if (ex === null || ex > Date.now()) ++lgDone;
            else lg.push([uid, d]);
        }
        shuffle(lg);
        for (const [uid, d] of lg) {
            promises.push(crawlLuogu(uid, d)
                .catch(err => {
                    error(err);
                }).finally(() => {
                    ++lgDone;
                    checkProgress();
                }));
        }
        for (const handle of cfHandles) {
            // CodeForces 不存在永久缓存，故不需要特殊处理 pri 变化
            if (await codeforcesDB.satisfied(codeforcesKey(handle))) {
                ++cfDone;
            } else {
                promises.push(crawlCodeforces(handle, codeforcesDuration(handle))
                    .catch(err => {
                        error(err);
                    }).finally(() => {
                        ++cfDone;
                        checkProgress();
                    }));
            }
        }
        for (const handle of atHandles) {
            if (await atcoderDB.satisfied(atcoderKey(handle))) {
                ++atDone;
            } else {
                promises.push(crawlAtcoder(handle, atcoderDuration(handle))
                    .catch(err => {
                        error(err);
                    }).finally(() => {
                        ++atDone;
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

await initialize();

chrome.runtime.onMessage.removeListener(tempListener);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "offscreen") return;
    switch (type) {
        case "query-users":
        case "query-pid":
        case "query-profile":
            mainloop();
            break;
    }
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
            sendResponse(profiles.get(data));
            break;
        case "query-progress":
            sendResponse({ done: lasLgDone + lasCfDone + lasAtDone, total: lgUIDs.length + cfHandles.length + atHandles.length });
            break;
        case "flush-cache":
            flushCache(data).then(() => mainloop());
            break;
        case "flush-specific-cache":
            flushSpecificCache(data.accounts, data.domains).then(() => mainloop());
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