console.log("离屏页面 >w<");

import { sleep } from "../public/lib/asyncio.js";
import { error } from "../public/lib/core.js";
import { CacheDB } from "../public/lib/database.js";
import { randint } from "../public/lib/random.js";

const proxyURL = "http://127.0.0.1:6969";
console.log(`服务端地址 ${proxyURL}`);

/** @type {Group[]}} */
const users = await (async () => {
    const resp = await fetch(`${proxyURL}/data`);
    if (!resp.ok) {
        throw new Error("无法获取数据，请检查服务端是否正常启动 :(");
    }
    return await resp.json();
})();
const lgUIDs = [];
for (const user of users) {
    for (const account of user.accounts) {
        lgUIDs.push(account.luogu);
    }
}

const luoguDB = new CacheDB("Luogu");
const atcoderDB = new CacheDB("AtCoder");
const codeforcesDB = new CacheDB("CodeForces");
await Promise.allSettled([luoguDB.init, atcoderDB.init, codeforcesDB.init]);

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

let luoguLock = Promise.resolve();
/** @param {number} uid */
async function crawlLuogu(uid) {
    const nxt = luoguLock.then(async () => {
        const url = `https://www.luogu.com.cn/user/${uid}/practice`;
        const resp = await fetch(new URL("proxy", proxyURL), { headers: { "x-target-url": url } });
        if (!resp.ok) {
            if (400 <= resp.status && resp.status < 500) {
                ;
            } else if (500 <= resp.status && resp.status < 600) {
                ;
            } else {
                ;
            }
        }
        return await resp.text();
    });
    luoguLock = nxt.then(sleep(randint(5000, 8000)));
    const data = await nxt;
    if (!data) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, "text/html");
    const content = JSON.parse(doc.getElementById("lentille-context").textContent);
    const { passed, submitted, user, privacy } = content.data;
    /** @type {LuoguPracticeNew} */
    const ret = {
        passed: [],
        submitted: [],
        name: user.name,
        privacy: privacy ?? false
    }
    for (const prob of submitted) {
        submittedMap.add(prob.pid, uid);
        ret.submitted.push(prob);
    }
    for (const prob of passed) {
        submittedMap.del(prob.pid, uid);
        passedMap.add(prob.pid, uid);
        ret.passed.push(prob);
    }
    profiles[uid] = { name: user.name, privacy: privacy ?? false };
    await luoguDB.set(`${uid}`, ret);
}

function send(type, data) {
    chrome.runtime.sendMessage({ "dst": "sw", type, data });
}

let lgDone = 0;
function checkProgress() {
    ;
}

let mainloopActive = false;
async function mainloop() {
    if (mainloopActive) return;
    mainloopActive = true;
    try {
        const promises = [];
        lgDone = 0;
        for (const uid of lgUIDs) {
            if (await luoguDB.satisfied(`${uid}`)) {
                ++lgDone;
            } else {
                promises.push(crawlLuogu(uid)
                    .then(() => {
                        ++lgDone;
                        checkProgress();
                    }, err => {
                        error(err);
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
    const data = await luoguDB.get(`${uid}`);
    if (!data) continue;
    const { passed, submitted, name, privacy } = data;
    for (const prob of submitted) {
        submittedMap.add(prob.pid, uid);
    }
    for (const prob of passed) {
        submittedMap.del(prob.pid, uid);
        passedMap.add(prob.pid, uid);
    }
    profiles[uid] = { name, privacy };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "offscreen") return;
    mainloop();
    switch (type) {
        case "query-pid":
            sendResponse({
                passed: Array.from(passedMap.get(data) ?? []),
                submitted: Array.from(submittedMap.get(data) ?? [])
            })
            break;
        case "query-profile":
            sendResponse(profiles[data] ?? {});
            break;
        case "query-progress":
            // if (cacheDB.closed) {
            //     sendResponse({ total: -1 });
            // } else {
            //     sendResponse({ done: virtualDone, total: accounts.length });
            // }
            break;
        case "flush-cache":
            // clear();
            break;
        case "clear-cache-physically":
            // clearPhysically();
            break;
        default: {
            error("Offscreen 无法识别的消息", message);
            break;
        }
    }
});
mainloop();