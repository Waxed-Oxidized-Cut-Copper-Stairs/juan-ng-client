// SPDX-License-Identifier: GPL-3.0-or-later

window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    if (e.origin !== location.origin) return;
    const message = e.data;
    if (message && message.authentication === "juan.hook.submit") {
        console.log("[juan.bridge]", message);
        chrome.runtime.sendMessage({ dst: "sw", type: "fuck-you-lg", data: message.payload })
            .catch(err => console.error("[juan.bridge]", err));
    }
});
console.log("Fucking Luogu Bridge Loaded");
