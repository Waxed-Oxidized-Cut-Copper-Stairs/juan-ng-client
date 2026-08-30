// SPDX-License-Identifier: GPL-3.0-or-later

/** @param {string} json */
function submitPracticePage(json) {
    // console.log("[juan.hook] submit", json);
    window.postMessage({
        authentication: "juan.hook.submit",
        payload: json
    }, location.origin);
}

(() => {
    // 不带 $ 以匹配带参数的路径
    const pattern = new RegExp("^https://www\\.luogu\\.com(?:\\.cn)/user/\\d+/practice");
    /** @param {string} url */
    function isTargetUrl(url) {
        return pattern.test(new URL(url, location.href).href);
    }

    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        // console.log("[juan.hook] fetch", args);
        const resp = await origFetch.apply(this, args);
        try {
            if (200 <= resp.status && resp.status < 300 && isTargetUrl(resp.url)) {
                const clonedResponse = resp.clone();
                clonedResponse.text()
                    .then(ret => {
                        submitPracticePage(ret);
                    })
                    .catch(err => {
                        console.error(err);
                    });
            }
        } catch (e) {
            console.error("[juan.hook] fetch hook error", e);
        }
        return resp;
    };

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        // console.log("[juan.hook] XMLHttpRequest", url);
        return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        const xhr = this;
        const handleLoad = function () {
            if (isTargetUrl(xhr.responseURL)) {
                if (200 <= xhr.status && xhr.status < 300) {
                    submitPracticePage(xhr.responseText);
                }
            }
        };
        if (!xhr.__onJuanListening) {
            xhr.__onJuanListening = true;
            xhr.addEventListener("load", handleLoad);
        }
        return origSend.apply(this, args);
    };
    console.log("Fucking Luogu Hook Loaded");
})();
