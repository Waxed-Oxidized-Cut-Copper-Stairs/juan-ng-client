// SPDX-License-Identifier: GPL-3.0-or-later

/** @type {Group[]}} */
const users = await chrome.runtime.sendMessage({ dst: "sw", type: "query-users" });

import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { acquireAllUserProfile, acquireOutline, flushCache, isCrawlLuoguPermitted, startCrawlLuogu, stopCrawlLuogu, subscribe } from "./protocol_v2.js";
import { Anchor, Button, percentToColor, percentToString, QuietAnchor, Username } from "./components/Generic";
import styles from "./popup.module.css";
import StatusBar from "./components/StatusBar.jsx";
import { registerRoot } from "./lib/darktheme.js";

const versionName = `${__JUAN_VERSION__} (${__COMMIT_HASH__})`;

/**
 * @param {Object} options
 * @param {number} options.crawled
 * @param {number} options.count
 */
function OutlineText({ crawled, count }) {
    if (crawled === count) {
        return (
            <>
                已更新全部 {count} 条数据
            </>
        )
    }
    return (
        <>
            已更新 {crawled} 条数据，占全部 {count} 条的 <span style={{ color: percentToColor(crawled / count), fontWeight: "bold" }}>{percentToString(crawled, count)}</span>
        </>
    )
}

function DatabaseOutline() {
    const [outline, setOutline] = useState({
        luogu: {
            count: 0,
            crawled: 0,
            outdated: []
        },
        codeforces: {
            count: 0,
            crawled: 0
        },
        atcoder: {
            count: 0,
            crawled: 0
        }
    });
    const [outdated, setOutdated] = useState(new Set());
    const [profiles, setProfiles] = useState(new Map());
    const [loading, setLoading] = useState(true);
    let cancelled = false;
    const update = useCallback(() => {
        acquireOutline()
            .then(outline => {
                if (cancelled) return;
                setOutline(outline);
                setOutdated(new Set(outline.luogu.outdated));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
    }, []);
    const updateProfile = useCallback(() => {
        acquireAllUserProfile().then(value => {
            if (!cancelled) setProfiles(new Map(value));
        });
    }, []);
    useEffect(() => {
        update();
        updateProfile();
        const id = setInterval(() => update(), 1000);
        const unload = subscribe("progress", () => update());
        const unload2 = subscribe("profile", () => updateProfile());
        return () => {
            cancelled = true;
            unload();
            unload2();
            clearInterval(id);
        }
    }, []);
    const nodeArr = [];
    for (const group of users) {
        for (const account of group.accounts) {
            const uid = account.luogu;
            if (outdated.has(uid)) {
                if (nodeArr.length) {
                    nodeArr.push(<span>, </span>);
                }
                /** @type {LuoguProfileNew} */
                const profile = profiles.get(uid) ?? {};
                nodeArr.push(
                    <QuietAnchor href={`https://www.luogu.com.cn/user/${uid}/practice`} thin={true}>
                        <Username className={profile.privacy ? styles.na : styles.outdated} account={account} profile={profile} displayStar={false}></Username>
                    </QuietAnchor>
                );
            }
        }
    }
    console.log(outdated, nodeArr);
    return (
        <div>
            数据库概要 <StatusBar />
            <br />
            {loading ? (
                <ul>
                    <li><div>洛谷：</div><div>数据加载中……</div></li>
                    <li>CodeForces：</li>
                    <li>AtCoder：</li>
                </ul>
            ) : (
                <ul>
                    <li>
                        <div>
                            洛谷：<OutlineText crawled={Math.min(outline.luogu.crawled, outline.luogu.count - outdated.size)} count={outline.luogu.count} />
                        </div>
                        <div>
                            {outdated.size ? (
                                <>
                                    有 <span className={styles.bad}>{outdated.size}</span> 条数据需要更新
                                    <div>{nodeArr}</div>
                                </>
                            ) : (
                                <><span className={styles.ok}>所有</span> 数据都是最新的</>
                            )}
                        </div>
                    </li>
                    <li>
                        CodeForces：<OutlineText crawled={outline.codeforces.crawled} count={outline.codeforces.count} />
                    </li>
                    <li>
                        AtCoder：<OutlineText crawled={outline.atcoder.crawled} count={outline.atcoder.count} />
                    </li>
                </ul>
            )}
        </div >
    )
}

function LuoguPermission() {
    const [permitted, setPermitted] = useState(false);
    const update = useCallback(() => {
        isCrawlLuoguPermitted().then(ret => setPermitted(ret));
    }, []);
    useEffect(() => {
        update();
        const id = setInterval(() => update(), 1000);
        return () => {
            clearInterval(id);
        }
    }, []);
    return (
        <div>
            <div>
                自动爬取洛谷通过情况：
                <Button onClick={() => { startCrawlLuogu(); setTimeout(() => update(), 100); }} confirm="自动爬取可能导致被洛谷封禁，请确认了解并自行承担风险后使用">允许</Button>
                <Button onClick={() => { stopCrawlLuogu(); setTimeout(() => update(), 100); }}>禁止</Button>
            </div>
            <div>
                当前状态：
                <span className={permitted ? styles.ok : styles.bad}>{permitted ? "允许" : "禁止"}</span>
                （{permitted ? <span className={styles.bad}>有风险</span> : "默认值"}）
            </div>
        </div>
    )
}

function CacheOperation() {
    return (
        <div>
            <div>
                缓存操作：
                <Button onClick={() => { flushCache(); }} confirm="此操作将刷新所有缓存，可能消耗较长时间。确定要刷新缓存吗？">刷新所有</Button>
                <Button onClick={() => { flushCache(["lg"]); }} confirm="此操作将刷新洛谷平台缓存，可能消耗较长时间。确定要刷新缓存吗？">刷新洛谷</Button>
                <Button onClick={() => { flushCache(["cf", "at"]); }}>刷新 CF/AT</Button>
            </div>
            {/* <div style={{ marginTop: "3px" }}>
                洛谷数据操作：
                <Button onClick={() => { }}>导入</Button>
                <Button onClick={() => { }}>导出</Button>
            </div> */}
        </div>
    )
}

export default function Popup() {
    return (
        <>
            <header className={styles.header}>
                <div className={styles.title}>联考水表机</div>
                <div>版本 {versionName}</div>
                <div>React {__REACT_VERSION__}, Vite {__VITE_VERSION__}</div>
            </header>
            <main className={styles.main}>
                <div>
                    <DatabaseOutline />
                </div>
                <div>
                    <LuoguPermission />
                    <CacheOperation />
                </div>
                <div>
                    本插件与洛谷、CodeForces 和 AtCoder 官方无任何关联。
                    <br />
                    插件采用必要的技术方法减轻对目标网站造成的负担，滥用导致的损害由用户自行负责。
                    <br />
                    数据来源：
                    <ul>
                        <li><Anchor href="https://www.luogu.com.cn/" thin={true}>洛谷（自动爬取/半自动添加数据）</Anchor></li>
                        <li><Anchor href="https://codeforces.com/apiHelp" thin={true}>CodeForces API</Anchor></li>
                        <li><Anchor href="https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md" thin={true}>AtCoder Problems（第三方 API）</Anchor></li>
                    </ul>
                </div>
            </main>
            <footer className={styles.footer}>
                <strong>Copyright (c) 2026 bluewindde</strong>
                <br />
                不含任何担保
                <br />
                详见 <Anchor href="https://www.gnu.org/licenses/gpl-3.0.html">GNU General Public License, version 3 or later</Anchor>
                <br />
                遇到问题，请汇报到 <Anchor href="https://github.com/Waxed-Oxidized-Cut-Copper-Stairs/juan-ng-client">GitHub 仓库</Anchor>
            </footer>
        </>
    )
}

createRoot(document.getElementById("app")).render(
    <StrictMode>
        <Popup />
    </StrictMode>
);

registerRoot(document.documentElement);