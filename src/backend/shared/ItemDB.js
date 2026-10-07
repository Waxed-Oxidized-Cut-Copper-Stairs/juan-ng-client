// SPDX-License-Identifier: GPL-3.0-or-later

/** @template T */
export class ItemDB {
    /** @type {IDBDatabase} */
    #db;
    #root;
    #storekey;
    #metakey;
    #capacity;
    /**
     * 在 IndexedDB 中使用 root 为数据库名称创建 ID 生成器
     * 初始化后需要调用 init 初始化
     * @param {string} root
     */
    constructor(root) {
        this.#db = null;
        this.#root = root;
        this.#storekey = "main";
        this.#metakey = "meta";
        this.#capacity = 0;
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
                reject(new Error("[ItemDB.init] Initalization failed.", { cause: req.error }));
            };
            req.onupgradeneeded = (event) => {
                /** @type {IDBDatabase} */
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storekey)) {
                    db.createObjectStore(this.#storekey);
                }
                if (!db.objectStoreNames.contains(this.#metakey)) {
                    db.createObjectStore(this.#metakey);
                }
            };
        }).then(async () => {
            this.#capacity = await this.capacity();
        });
    }
    async capacity() {
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#metakey, "readonly");
            const req = tx.objectStore(this.#metakey).get("capacity");
            tx.oncomplete = () => resolve(req.result ?? 0);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /**
     * 生成新 id，对应的值需要通过 set 存入
     * @returns {Promise<string>}
     */
    async generate() {
        return new Promise((resolve, reject) => {
            const id = (++this.#capacity).toString();
            const tx = this.#db.transaction(this.#metakey, "readwrite");
            tx.objectStore(this.#metakey).put(this.#capacity, "capacity");
            tx.oncomplete = () => resolve(id);
            tx.onerror = () => {
                --this.#capacity;
                reject(tx.error);
            };
            tx.onabort = () => {
                --this.#capacity;
                reject(tx.error);
            };
        });
    }
    /**
     * 存入一个值
     * 存多个值请用 setMany
     * @param {string} id
     * @param {T} value
     * @note 注意：此函数会修改 value 的 id，以保持一致性
     */
    async set(id, value) {
        value.id = id;
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            tx.objectStore(this.#storekey).put(value, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /**
     * 存入多个值
     * 存一个值请用 set
     * @param {[string, T][]} items
     * @note 注意：此函数会修改 items 的 id，以保持一致性
     */
    async setMany(items) {
        for (const [id, value] of items) {
            value.id = id;
        }
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            const obj = tx.objectStore(this.#storekey);
            for (const [id, value] of items) {
                obj.put(value, id);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /**
     * @param {string | string[]} id
     * @returns {Promise<T | undefined | (T | undefined)[]>}
     */
    async get(id) {
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readonly");
            if (typeof id === "string") {
                const req = tx.objectStore(this.#storekey).get(id);
                tx.oncomplete = () => resolve(req.result);
            } else {
                const obj = tx.objectStore(this.#storekey);
                const reqs = id.map((x) => obj.get(x));
                tx.oncomplete = () => resolve(reqs.map((x) => x.result));
            }
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /** @returns {Promise<T[]>} */
    async getAll() {
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readonly");
            const req = tx.objectStore(this.#storekey).getAll();
            tx.oncomplete = () => resolve(req.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
}

/** @type {ItemDB<Account>} */
export const accountsDB = new ItemDB("shared.accounts");
/** @type {ItemDB<User>} */
export const usersDB = new ItemDB("shared.users");
/** @type {ItemDB<Group>} */
export const groupsDB = new ItemDB("shared.groups");
accountsDB.init();
usersDB.init();
groupsDB.init();