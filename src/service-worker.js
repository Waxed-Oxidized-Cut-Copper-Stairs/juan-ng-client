// SPDX-License-Identifier: GPL-3.0-or-later

import { error, warning } from "./lib/core.js";

const offscreenReady = (async () => {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["WORKERS"],
        justification: "需要常驻 Worker 执行爬取任务",
    });
    const promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            warning("10s 内仍未正常启动 Offscreen");
        }, 10000);
        const listener = (message, sender, sendResponse) => {
            const { dst, type } = message;
            if (dst !== "sw") return;
            if (type === "offscreen-ready") {
                clearTimeout(timer);
                chrome.runtime.onMessage.removeListener(listener);
                resolve();
            }
        };
        chrome.runtime.onMessage.addListener(listener);
    });
    chrome.runtime.sendMessage({ dst: "offscreen", type: "is-ready" });
    await promise;
})();

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
        case "query-origin":
        case "query-profile":
        case "query-progress": {
            sendResponseWrapper(offscreenReady.then(async () => {
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
            // Edge 支持分屏，但 Chromium 没有提供对应的查询接口，导致分屏状态下消息同步有问题
            // Firefox 的 Web Extension API 也无法正确处理消息同步
            chrome.tabs.query({
                active: true,
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
        case "flush-specific-cache": {
            offscreenReady.then(() => {
                chrome.runtime.sendMessage({ dst: "offscreen", type, data }).catch(err => null);
            }, err => error(err));
            break;
        }
        case "offscreen-ready":
            break;
        default: {
            error("Service Worker 无法识别的消息", message);
            break;
        }
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    chrome.tabs.sendMessage(details.tabId, { type: "route" }).catch(err => error(err));
});

console.log("Service Worker Loaded >w<");
