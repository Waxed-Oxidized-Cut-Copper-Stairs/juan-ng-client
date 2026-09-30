// SPDX-License-Identifier: GPL-3.0-or-later

import { error } from "../shared/core";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { dst, type, data } = message;
    if (dst !== "sw") return;
    switch (type) {
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    chrome.tabs.sendMessage(details.tabId, { dst: "tab", type: "route" }).catch(err => error(err));
});

console.log("Service Worker Loaded >w<");
