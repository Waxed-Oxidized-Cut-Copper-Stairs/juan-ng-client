// SPDX-License-Identifier: GPL-3.0-or-later

import { memo, useCallback, useEffect, useRef, useState } from "react";
import LineEdit, { LineEditStyledForSearch } from "../parts/LineEdit";
import { getAccountList } from "../protocol";
import { fmtPlatformName } from "../../shared/fmt";
import styles from "./AccountsPanel.module.css";
import { bus } from "../bus";

/**
 * @param {Object} options
 * @param {Account} options.account
 * @param {boolean} options.checked
 */
const AccountBadge = memo(function AccountBadge({ account, checked }) {
    return (
        <div
            className={styles.badge}
            data-platform={account.platform}
            data-account-id={account.id}
            data-checked={checked}>
            <div className={styles.split}>
                <div className={styles.circle} data-checked={checked} />
                <strong>{account.name ?? `${account.platform}@${account.uid}`}</strong>
            </div>
            <div className={styles.info}>
                <div>{`#${account.id}`} {fmtPlatformName(account.platform)}</div>
                <div>{`上次更新于 ${account.last_updated}`}</div>
                <div>{`将过期于 ${account.expire_at}`}</div>
            </div>
        </div>
    )
});

export default function AccountsPanel({ busId }) {
    const [accounts, setAccounts] = useState([]);
    const [selected, setSelected] = useState({});
    const [searchText, setSearchText] = useState("");
    const [errorText, setErrorText] = useState("");
    /** @type {{current: Account[]}} */
    const accountsRef = useRef([]);
    const selectedRef = useRef(selected);
    const searchRef = useRef(null);
    const dragRef = useRef({ active: false, value: false });
    const rafRef = useRef(0);
    const pendingRef = useRef(null);
    const update = useCallback(() => {
        getAccountList().then((ret) => {
            accountsRef.current = ret;
            setAccounts(ret);
        });
    }, []);
    const search = useCallback((text) => {
        if (!text || typeof text !== "string") {
            setAccounts(accountsRef.current);
            return;
        }
        if (text.includes("@")) {
            const [oj, handle] = text.split("@", 2).map((value) => value.trim());
            setAccounts(accountsRef.current.filter((account) => {
                return account.platform === oj && (account.uid.includes(handle) || account.name?.includes(handle));
            }));
        } else {
            const handle = text.trim();
            setAccounts(accountsRef.current.filter((account) => {
                return account.platform === handle || account.uid.includes(handle) || account.name?.includes(handle);
            }));
        }
        setAccounts(accountsRef.current.filter(filter));
    }, [searchText]);
    const attemptAdd = useCallback(() => {
        // TODO
        setErrorText("功能未实现");
    }, []);
    const flush = useCallback(() => {
        rafRef.current = 0;
        if (pendingRef.current) {
            setSelected(pendingRef.current);
            pendingRef.current = null;
        }
    }, []);
    const setChecked = useCallback((id, value) => {
        if (!!selectedRef.current[id] === value) return;
        const next = { ...selectedRef.current, [id]: value };
        selectedRef.current = pendingRef.current = next;
        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(flush);
        }
    }, [flush]);
    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        const el = e.target.closest("[data-account-id]");
        if (!el) return;
        e.preventDefault();
        const id = Number(el.dataset.accountId);
        const value = !selectedRef.current[id];
        dragRef.current = { active: true, value };
        setChecked(id, value);
    }, [setChecked]);
    const handleMouseOver = useCallback((e) => {
        if (!dragRef.current.active) return;
        const el = e.target.closest("[data-account-id]");
        if (!el) return;
        setChecked(Number(el.dataset.accountId), dragRef.current.value);
    }, [setChecked]);
    const focusOn = useCallback(() => {
        /** @type {HTMLInputElement} */
        const input = searchRef.current;
        if (!input) return;
        input.focus();
        input.select();
    }, []);
    useEffect(() => {
        update();
    }, [update]);
    useEffect(() => {
        const abort = new AbortController();
        const stop = () => { dragRef.current.active = false; };
        bus.on(`${busId}.focus`, focusOn);
        window.addEventListener("mouseup", stop, { signal: abort.signal });
        window.addEventListener("blur", stop, { signal: abort.signal });
        return () => {
            abort.abort();
            bus.off(`${busId}.focus`, focusOn);
        };
    }, [focusOn]);
    return (
        <div className={styles.main}>
            <div>
                <LineEditStyledForSearch>
                    <LineEdit
                        ref={searchRef}
                        text={searchText}
                        setText={setSearchText}
                        placeholder={"键入以搜索"}
                        onChange={search}
                        onReturn={attemptAdd} />
                </LineEditStyledForSearch>
                <div>格式：平台名称 + @ + 账号 ID，例如 <code>lg@123456</code> 和 <code>cf@MikeMirzayanov</code>，不区分大小写</div>
                <div>
                    搜索的账号如果不存在，可以按下回车创建
                    {errorText.length !== 0 && (<span className={styles.error}>错误：{errorText}</span>)}
                </div>
            </div>
            <div className={styles.body}>
                <div
                    className={styles.container}
                    onMouseDown={handleMouseDown}
                    onMouseOver={handleMouseOver}>
                    {accounts.length === 0 ? (
                        <div className={styles.account_placeholder}>暂无数据</div>
                    ) : (accounts.map((account) => {
                        return (
                            <AccountBadge key={account.id} account={account} checked={!!selected[account.id]} />
                        )
                    }))}
                </div>
            </div>
        </div>
    )
}