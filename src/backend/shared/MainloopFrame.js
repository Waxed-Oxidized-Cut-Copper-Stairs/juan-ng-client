// SPDX-License-Identifier: GPL-3.0-or-later

import { SeizeLock, sleep } from "../../shared/asyncio";
import { error, log, warning } from "../../shared/core";
import { accountsDB } from "./ItemDB";

/**
 * @typedef {{
 *   ok: number | null,
 *   fail: number | null
 * }} DurationConfig
 */
/** @type {DurationConfig} */
const defaultDurationConfig = {
    ok: 24 * 60 * 60 * 1000,
    fail: 6 * 60 * 60 * 1000
};
/**
 * @param {number} now
 * @param {number | null} d
 */
function durationCalc(now, d) {
    if (typeof d !== "number") return null;
    return now + d;
}

export class MainloopFrame {
    #platform;
    #urlConstructor;
    #handler;
    #gap;
    #durationConfig;
    #timeout;
    #lastCrawl = 0;
    #mainloopBusy = false;
    #mainloopPending = false;
    #lock;
    /**
     * @param {Platform} platform
     * @param {(account: Account) => string} urlConstructor
     * @param {((account: Account, resp: Response) => Promise<Account>)} handler
     * @param {number} gap
     * @param {DurationConfig} [durationConfig]
     * @param {number} [timeout]
     */
    constructor(platform, urlConstructor, handler, gap, durationConfig = defaultDurationConfig, timeout = 10000) {
        this.#platform = platform;
        this.#urlConstructor = urlConstructor;
        this.#handler = handler;
        this.#durationConfig = durationConfig;
        this.#gap = gap;
        this.#timeout = timeout;
        this.#lock = new SeizeLock();
    }
    async #sleep() {
        const now = Date.now();
        if (now - this.#lastCrawl < this.#gap) {
            await sleep(this.#gap - (now - this.#lastCrawl));
        }
    }
    async #mainloop() {
        await accountsDB.init();
        const accounts = (await accountsDB.getAll()).filter((account) => account.platform === this.#platform);
        /** @type {Account[]} */
        const update = [];
        const reportOK = (/** @type {Account} */ account) => {
            try {
                /** @type {Account} */
                const newAccount = structuredClone(account);
                newAccount.last_updated = Date.now();
                newAccount.expire_at = durationCalc(newAccount.last_updated, this.#durationConfig.ok);
                update.push(newAccount);
            } catch (err) {
                error(`MainloopFrame(${this.#platform}).reportOK`, err);
            }
        };
        const reportFAIL = (/** @type {Account} */ account) => {
            try {
                /** @type {Account} */
                const newAccount = structuredClone(account);
                newAccount.expire_at = durationCalc(Date.now(), this.#durationConfig.fail);
                update.push(newAccount);
            } catch (err) {
                error(`MainloopFrame(${this.#platform}).reportFAIL`, err);
            }
        };
        for (const account of accounts) {
            const now = Date.now();
            // undefined 表示未抓取
            // null 表示永久缓存，永不更新
            // number 表示在某时刻过期
            // NaN inf 和非数字对象都是异常值，不定义行为
            if ((typeof account.expire_at === "number" && account.expire_at > now) || account.expire_at === null) {
                continue;
            }
            await this.#lock.acquire();
            try {
                await this.#sleep();
                const abort = new AbortController();
                const timerId = setTimeout(() => abort.abort(), this.#timeout);
                try {
                    const url = this.#urlConstructor(account);
                    log(`MainloopFrame(${this.#platform}).fetch`, url);
                    await fetch(url, { signal: abort.signal }).then(
                        async (resp) => {
                            if (resp.ok) {
                                try {
                                    reportOK(await this.#handler(structuredClone(account), resp));
                                } catch (err) {
                                    error(`MainloopFrame(${this.#platform}).#handler`, err);
                                    reportFAIL(account);
                                }
                            } else {
                                warning(`MainloopFrame(${this.#platform}).fetch`, `HTTP ${resp.status} ${resp.statusText}`);
                                reportFAIL(account);
                                await resp.body?.cancel();
                            }
                        },
                        async (err) => {
                            error(`MainloopFrame(${this.#platform}).fetch-reject`, err);
                            reportFAIL(account);
                        }
                    );
                } catch (err) {
                    error(`MainloopFrame(${this.#platform}).fetch`, err);
                    reportFAIL(account);
                } finally {
                    this.#lastCrawl = Date.now();
                    if (!abort.signal.aborted) clearTimeout(timerId);
                }
            } finally {
                this.#lock.release();
            }
        }
        await accountsDB.setMany(update.map((account) => [account.id, account]));
    }
    /**
     * 抢占执行一个 API 请求，仍受 gap 限制频率
     * 实际上是高低两个优先级排队，无法打断正在执行的任务
     * 此函数返回的 Promise 在 callback 执行完毕或发生内部错误时 resolve
     * @param {string} url
     * @param {(resp: Response) => Promise<void>} callback
     */
    async seize(url, callback) {
        await this.#lock.seize();
        try {
            await this.#sleep();
            const abort = new AbortController();
            const timerId = setTimeout(() => abort.abort(), this.#timeout);
            try {
                await fetch(url, { signal: abort.signal }).then(
                    async (resp) => {
                        if (resp.ok) {
                            await callback(resp);
                        } else {
                            await resp.body?.cancel();
                        }
                    },
                    async (err) => {
                        error(`MainloopFrame(${this.#platform}).seize-reject`, err);
                    }
                );
            } catch (err) {
                error(`MainloopFrame(${this.#platform}).seize`, err);
            } finally {
                this.#lastCrawl = Date.now();
                if (!abort.signal.aborted) clearTimeout(timerId);
            }
        } finally {
            this.#lock.release();
        }
    }
    /**
     * @note 不应该尝试等待此函数返回的 Promise
     */
    async mainloop() {
        if (this.#mainloopBusy) {
            this.#mainloopPending = true;
            return;
        }
        this.#mainloopBusy = true;
        try {
            await this.#mainloop();
        } catch (err) {
            error(`MainloopFrame(${this.#platform}).#mainloop`, err);
        } finally {
            this.#mainloopBusy = false;
            if (this.#mainloopPending) {
                this.#mainloopPending = false;
                this.mainloop();
            }
        }
    }
}