// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from "react";
import LineEdit, { LineEditStyledForSearch } from "../parts/LineEdit";
import { fmtPlatformName } from "../../shared/fmt";
import { subscribe } from "../bus";
import { TimeLabel } from "../parts/TimeLabel";
import { MetaDataServer } from "../parts/MetaDataServer";
import { Button } from "../parts/Button";
import styles from "./GroupsPanel.module.css";
import { LuDownload, LuFolderPlus, LuGripVertical, LuListCheck, LuListPlus, LuRefreshCw, LuTrash2, LuUpload, LuUserPlus } from "react-icons/lu";
import { deleteGroup, updateGroup } from "../protocol";

/**
 * @param {Object} options
 * @param {Account} options.account
 */
export function SignleAccount({ account }) {
    return (
        <div className={styles.account}>
            <div className={styles.account_badge} data-platform={account.platform}>
                {fmtPlatformName(account.platform)}
            </div>
            {account.name ? (
                <div className={styles.account_name}>
                    {account.name} ({account.uid})
                </div>
            ) : (
                <div className={styles.account_name}>
                    {account.uid}
                </div>
            )}
            <div className={styles.info}>
                {(account.last_updated === undefined) ? (
                    <span>从未更新</span>
                ) : (
                    <span>最后更新于 <TimeLabel ms={account.last_updated} /></span>
                )}
            </div>
            <div className={styles.info}>
                {(account.expire_at === null) ? (
                    <span>缓存永不过期</span>
                ) : (
                    account.last_updated ? (
                        <span>缓存将过期于 <TimeLabel ms={account.expire_at} /></span>
                    ) : (
                        <></>
                    )
                )}
            </div>
            <Button><LuRefreshCw size={15} /></Button>
            <Button className={styles.danger}><LuTrash2 size={15} /></Button>
        </div>
    )
}

/**
 * @param {Object} options
 * @param {User} options.user
 * @param {Map<InternalID, Account>} options.accounts
 */
export function SingleUser({ user, accounts }) {
    const [fold, setFold] = useState(false);
    const bodyRef = useRef(null);
    const svgRef = useRef(null);
    useEffect(() => {
        /** @type {HTMLDivElement} */
        const body = bodyRef.current;
        /** @type {HTMLElement} */
        const svg = svgRef.current;
        if (fold) {
            if (body) body.style.display = "none";
            if (svg) svg.style.transform = "rotate(-90deg)";
        } else {
            if (body) body.style.display = "";
            if (svg) svg.style.transform = "rotate(0deg)";
        }
    }, [fold]);
    return (
        <div>
            <div className={styles.user_header} onClick={() => setFold(!fold)}>
                <LuGripVertical size={15} />
                <svg
                    ref={svgRef}
                    className={styles.fold_button}
                    width="16"
                    height="16"
                    viewBox="0 0 16 16">
                    <path
                        d="M5.2 5.6 L10.8 5.6 L8 10 Z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round" />
                </svg>
                <div className={styles.user_title}>
                    <span className={styles.info}>#{user.id}</span>
                    {user.display_name.value}
                </div>
                <Button><LuListPlus size={15} /></Button>
                <Button className={styles.danger}><LuTrash2 size={15} /></Button>
            </div>
            <div ref={bodyRef} className={styles.user_body}>
                {user.accounts.map((accountId, idx, arr) => {
                    const account = accounts.get(accountId);
                    if (!account) return;
                    return <SignleAccount key={accountId} account={account} />
                })}
            </div>
        </div >
    )
}

/**
 * @param {Object} options
 * @param {Group} options.group
 * @param {Map<InternalID, Account>} options.accounts
 * @param {Map<InternalID, User>} options.users
 */
function SingleGroup({ group, accounts, users }) {
    const [fold, setFold] = useState(false);
    const bodyRef = useRef(null);
    const svgRef = useRef(null);
    const deleteSelf = useCallback(async () => {
        await deleteGroup(group.id);
    }, []);
    useEffect(() => {
        if (fold) {
            bodyRef.current.style.display = "none";
            svgRef.current.style.transform = "rotate(-90deg)";
        } else {
            bodyRef.current.style.display = "";
            svgRef.current.style.transform = "rotate(0deg)";
        }
    }, [fold]);
    return (
        <div className={styles.group}>
            <div className={styles.group_header} onClick={() => setFold(!fold)}>
                <LuGripVertical size={15} />
                <svg
                    ref={svgRef}
                    className={styles.fold_button}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24">
                    <path
                        d="M7.8 8.4 L16.2 8.4 L12 15 Z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round" />
                </svg>
                <div className={styles.group_title}>
                    <span className={styles.info}>#{group.id}</span>
                    {group.name}
                </div>
                <Button><LuListCheck size={15} /></Button>
                <Button><LuUserPlus size={15} /></Button>
                <Button className={styles.danger} onClick={deleteSelf}><LuTrash2 size={15} /></Button>
            </div>
            <div ref={bodyRef} className={styles.group_body}>
                {group.members.map((userId, idx, arr) => {
                    const user = users.get(userId);
                    if (!user) return;
                    return <SingleUser key={userId} user={user} accounts={accounts} />
                })}
            </div>
        </div>
    )
}

/**
 * @param {Object} options
 * @param {Map<InternalID, Account>} options.accounts
 * @param {Map<InternalID, User>} options.users
 * @param {Map<InternalID, Group>} options.groups
 * @param {InternalID[]} options.order
 */
function Main({ busId, accounts, users, groups, order }) {
    const [searchText, setSearchText] = useState("");
    const [errorText, setErrorText] = useState("");
    /** @type {UseState<Account[]>} */
    const [realUsers, setRealUsers] = useState([]);
    const searchRef = useRef(null);
    const attemptAdd = useCallback(() => {
        setErrorText("功能未实现");
    }, []);
    const focusOn = useCallback(() => {
        /** @type {HTMLInputElement} */
        const input = searchRef.current;
        if (!input) return;
        input.focus();
        input.select();
    }, []);
    const addGroup = useCallback(async () => {
        await updateGroup({ name: "新分组", members: [] });
    }, []);
    useEffect(() => {
        if (!searchText) {
            setRealUsers(users);
            return;
        }
        // 功能未实现
        setRealUsers(users);
    }, [users, searchText]);
    useEffect(() => {
        const unload = subscribe(`${busId}.GroupsPanel.focus`, focusOn);
        return () => {
            unload();
        };
    }, [busId, focusOn]);
    return (
        <div className={styles.main}>
            <div className={styles.header}>
                <div className={styles.header_search}>
                    <LineEditStyledForSearch>
                        <LineEdit
                            ref={searchRef}
                            text={searchText}
                            setText={setSearchText}
                            placeholder={"搜索或添加"}
                            onReturn={attemptAdd} />
                    </LineEditStyledForSearch>
                </div>
                <Button className={styles.header_button} onClick={addGroup}><LuFolderPlus size={24} /></Button>
                <Button className={styles.header_button}><LuUpload size={24} /></Button>
                <Button className={styles.header_button}><LuDownload size={24} /></Button>
            </div>
            <div>
                {errorText.length !== 0 && (<span className={styles.error}>错误：{errorText}</span>)}
            </div>
            <div className={styles.body}>
                <div className={styles.container}>
                    {order.map((ord) => {
                        const group = groups.get(ord);
                        if (!group) return;
                        return <SingleGroup key={group.id} group={group} accounts={accounts} users={realUsers} />
                    })}
                </div>
            </div>
        </div>
    )
}

export function GroupsPanel({ busId }) {
    return (
        <MetaDataServer>
            <Main />
        </MetaDataServer>
    )
}