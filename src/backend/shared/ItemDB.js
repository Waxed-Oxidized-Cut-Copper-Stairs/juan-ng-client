// SPDX-License-Identifier: GPL-3.0-or-later

/** @template T */
export class ItemDB {
    /** @type {IDBDatabase | null} */
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
        await /** @type {Promise<void>} */(new Promise((resolve, reject) => {
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
                // @ts-ignore
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storekey)) {
                    db.createObjectStore(this.#storekey);
                }
                if (!db.objectStoreNames.contains(this.#metakey)) {
                    db.createObjectStore(this.#metakey);
                }
            };
        })).then(async () => {
            this.#capacity = await this.capacity();
        });
    }
    async capacity() {
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
            const tx = this.#db.transaction(this.#metakey, "readonly");
            const req = tx.objectStore(this.#metakey).get("capacity");
            tx.oncomplete = () => resolve(req.result ?? 0);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /**
     * 生成新 id，对应的值需要通过 set 存入
     * 为处理竞态关系，此函数是同步函数，生成后应当调用 syncmeta 同步元数据
     * @returns {InternalID}
     */
    generate() {
        return /** @type {InternalID} */ ((++this.#capacity).toString());
    }
    /**
     * 同步元数据
     * @returns {Promise<void>}
     */
    async syncmeta() {
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
            const tx = this.#db.transaction(this.#metakey, "readwrite");
            tx.objectStore(this.#metakey).put(this.#capacity, "capacity");
            tx.oncomplete = () => resolve();
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
     * @param {InternalID} id
     * @param {T & { id: InternalID }} value
     * @returns {Promise<void>}
     * @note 注意：此函数会修改 value 的 id，以保持一致性
     */
    async set(id, value) {
        value.id = id;
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
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
     * @param {[InternalID, T & { id: InternalID }][]} items
     * @returns {Promise<void>}
     * @note 注意：此函数会修改 items 的 id，以保持一致性
     */
    async setMany(items) {
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            const obj = tx.objectStore(this.#storekey);
            for (const [id, value] of items) {
                value.id = id;
                obj.put(value, id);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /**
     * 删除一个 id 对应的值
     * @param {InternalID} id
     * @returns {Promise<void>}
     */
    async del(id) {
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            tx.objectStore(this.#storekey).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /**
     * @overload
     * @param {InternalID} id
     * @returns {Promise<T | undefined>}
     */
    /**
     * @overload
     * @param {InternalID[]} id
     * @returns {Promise<Record<InternalID, T | undefined>>}
     */
    /**
     * @param {InternalID | InternalID[]} id
     * @returns {Promise<T | undefined | Record.<InternalID, T | undefined>>}
     */
    async get(id) {
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
            const tx = this.#db.transaction(this.#storekey, "readonly");
            if (typeof id === "string") {
                const req = tx.objectStore(this.#storekey).get(id);
                tx.oncomplete = () => resolve(req.result);
            } else {
                const obj = tx.objectStore(this.#storekey);
                /** @type {Record.<InternalID, T | undefined>} */
                const result = {};
                for (const x of id) {
                    const req = obj.get(x);
                    req.onsuccess = () => { result[x] = req.result; };
                }
                tx.oncomplete = () => resolve(result);
            }
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /** @returns {Promise<T[]>} */
    async getAll() {
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
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