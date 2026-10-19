// SPDX-License-Identifier: GPL-3.0-or-later

import mitt from "mitt";

const bus = mitt();

/**
 * 订阅一个事件，返回取消订阅的函数
 * @param {string} event
 * @param {(payload: any) => void} callback
 */
export function subscribe(event, callback) {
    bus.on(event, callback);
    return () => {
        bus.off(event, callback);
    };
}
/**
 * 触发一个事件
 * @param {string} event
 * @param {any} payload
 */
export function emit(event, payload) {
    bus.emit(event, payload);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "tab") return;
    switch (type) {
        case "meta-change":
            emit("meta");
            break;
        case "data-change":
            emit("data");
            break;
        case "route":
            emit("route", data);
            break;
    }
});
