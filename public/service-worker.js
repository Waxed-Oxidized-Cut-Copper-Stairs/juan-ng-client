import { error } from "./lib/core.js";

/** @type {Promise<void> | null} */
let offscreenPromise = Promise.resolve();
async function createOffscreen() {
    offscreenPromise = offscreenPromise.then(async () => {
        if (await chrome.offscreen.hasDocument()) return;
        await chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ["WORKERS"],
            justification: "需要常驻 Worker 执行爬取任务",
        });
    });
    return offscreenPromise;
}
async function killOffscreen() {
    offscreenPromise = offscreenPromise.then(async () => {
        if (!await chrome.offscreen.hasDocument()) return;
        await chrome.offscreen.closeDocument();
    });
    return offscreenPromise;
}

/**
 * @param {Promise} promise
 * @param {(response?: any) => void} sendResponse
 */
async function sendResponseWrapper(promise, sendResponse) {
    return promise.catch(err => {
        error(err);
        try { sendResponse(); }
        catch (err) { error("无法发送响应", err); }
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "sw") return;
    switch (type) {
        case "query-users":
        case "query-pid":
        case "query-profile":
        case "query-progress": {
            sendResponseWrapper(createOffscreen().then(async () => {
                return chrome.runtime.sendMessage({ dst: "offscreen", type, data });
            }).then(async resp => {
                sendResponse(resp);
            }), sendResponse);
            return true;
        }
        case "query-uid": {
            sendResponseWrapper(chrome.cookies.get({ url: "https://*.luogu.com.cn", name: "_uid" }).then(
                cookies => {
                    if (cookies) {
                        const uid = Number.parseInt(cookies.value);
                        if (!isNaN(uid)) sendResponse(uid);
                        else sendResponse();
                    } else sendResponse();
                }
            ), sendResponse);
            return true;
        }
        case "route-to-active-tabs": {
            chrome.tabs.query({
                active: true, highlighted: true,
                url: [
                    "https://www.luogu.com.cn/*",
                    "https://www.luogu.me/*"
                ]
            }).then(tabs => {
                for (const tab of tabs) {
                    chrome.tabs.sendMessage(tab.id, data).catch(err => null);
                }
            }).catch(err => error(err));
            break;
        }
        case "notify": {
            const { title, msg } = data;
            chrome.notifications.create({
                type: "basic",
                iconUrl: "assets/icon.png",
                title: title,
                message: msg,
                priority: 1
            });
            break;
        }
        case "flush-cache":
        case "clear-cache-physically": {
            createOffscreen().then(() => {
                chrome.runtime.sendMessage({ dst: "offscreen", type }).catch(err => null);
            }, err => error(err));
            break;
        }
        case "kill-offscreen": {
            killOffscreen();
            break;
        }
        default: {
            error("Service Worker 无法识别的消息", message);
            break;
        }
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    const url = new URL(details.url);
    if (url.hostname === "www.luogu.com.cn" || url.hostname === "www.luogu.me") {
        chrome.tabs.sendMessage(details.tabId, { type: "route" }).catch(err => error(err));
    }
});

console.log("Service Worker Loaded >w<");
