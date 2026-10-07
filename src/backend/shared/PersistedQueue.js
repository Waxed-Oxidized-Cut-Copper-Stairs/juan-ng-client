// SPDX-License-Identifier: GPL-3.0-or-later

import { error } from "../../shared/core";

/**
 * 持久化任务队列，适用于 Service Worker
 * 保证每个任务最多执行一次，可能在出现异常或 Service Worker 关闭时丢失
 * 使用者需要保证对同一个键全局单例，以及及时使用 await init() 初始化
 * 
 */
export class PersistedQueue {
    #key;
    #handler;
    #running;
    #pending;
    /** @type {IDBDatabase} */
    #db;
    #root;
    #storekey;
    #indexkey;
    /**
     * 在 IndexedDB 中使用 shared.QueueDB 为数据库名称创建持久化队列，如果需要更改存储位置，请传入 root 参数
     * 初始化后需要调用 init 初始化和 activate 执行积压任务
     * @param {string} key
     * @param {(...args: any[]) => Promise<void>} handler
     * @param {string} root
     */
    constructor(key, handler, root = "shared.QueueDB") {
        this.#key = key;
        this.#handler = handler;
        this.#running = false;
        this.#pending = false;
        this.#db = null;
        this.#root = root;
        this.#storekey = "main";
        this.#indexkey = "by";
    }
    async init() {
        if (this.#db !== null) return;
        await new Promise((resolve, reject) => {
            const req = indexedDB.open(this.#root, 1);
            req.onsuccess = () => {
                this.#db = req.result;
                this.#db.onclose = () => {
                    this.#db = null;
                };
                resolve();
            };
            req.onerror = () => {
                reject(new Error("[PersistedQueue.init] Initalization failed.", { cause: req.error }));
            };
            req.onupgradeneeded = (event) => {
                /** @type {IDBDatabase} */
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storekey)) {
                    const store = db.createObjectStore(this.#storekey, { autoIncrement: true });
                    store.createIndex(this.#indexkey, "name");
                }
            };
        });
    }
    async #enqueue(args) {
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            tx.objectStore(this.#storekey).add({ name: this.#key, args });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    async #dequeue() {
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            const index = tx.objectStore(this.#storekey).index(this.#indexkey);
            const req = index.openCursor(IDBKeyRange.only(this.#key));
            let args = null;
            req.onsuccess = () => {
                const cursor = req.result;
                if (!cursor) return;
                args = cursor.value.args;
                cursor.delete();
            };
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => resolve(args);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    async push(...args) {
        await this.#enqueue(args);
        this.activate();
    }
    async clear() {
        await new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            const index = tx.objectStore(this.#storekey).index(this.#indexkey);
            const req = index.openKeyCursor(IDBKeyRange.only(this.#key));
            req.onsuccess = () => {
                const cursor = req.result;
                if (!cursor) return;
                cursor.delete();
                cursor.continue();
            };
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    activate() {
        queueMicrotask(() => {
            this.#mainloop().catch(err => {
                error("PersistedQueue.#mainloop", err);
                setTimeout(() => this.activate(), 1000);
            });
        });
    }
    async #mainloop() {
        if (this.#running) {
            this.#pending = true;
            return;
        }
        this.#running = true;
        let processed = false;
        try {
            const task = await this.#dequeue();
            if (task !== null) {
                processed = true;
                try {
                    await this.#handler(...task);
                } catch (err) {
                    error("PersistedQueue.#handler", err);
                }
            }
        } finally {
            this.#running = false;
        }
        if (processed || this.#pending) {
            this.#pending = false;
            this.activate();
        }
    }
}