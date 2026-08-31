// SPDX-License-Identifier: GPL-3.0-or-later

import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { acquireOutline, flushCache, isCrawlLuoguPermitted, startCrawlLuogu, stopCrawlLuogu, subscribe } from "./protocol_v2.js";
import { Anchor, Button, LightAnchor, percentToColor, percentToString } from "./components/Generic";
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
    const [outdated, setOutdated] = useState([]);
    const [loading, setLoading] = useState(true);
    const exportOutdatedRef = useRef(null);
    const exportOutdatedAsMdRef = useRef(null);
    let cancelled = false;
    const update = useCallback(() => {
        acquireOutline()
            .then(outline => {
                if (cancelled) return;
                setOutline(outline);
                setOutdated(outline.luogu.outdated);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
    }, []);
    const exportOutdated = useCallback(() => {
        ;
    }, []);
    const exportOutdatedAsMd = useCallback(() => {
        ;
    }, []);
    const exportData = useCallback(() => {
        ;
    }, []);
    useEffect(() => {
        update();
        const unload = subscribe("progress", () => update());
        return () => {
            cancelled = true;
            unload();
        }
    }, []);
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
                            洛谷：<OutlineText crawled={outline.luogu.crawled} count={outline.luogu.count} />
                        </div>
                        <div>
                            {outdated.length ? (
                                <>
                                    有 <span className={styles.bad}>{outdated.length}</span> 条数据需要更新
                                    <div className={styles.outdated_list}>
                                        {outdated.map((uid, idx, arr) => {
                                            return (
                                                <span>{uid}</span>
                                            )
                                        })};
                                    </div>
                                    <div>
                                        <Button ref={exportOutdatedRef} onClick={() => exportOutdated()}>复制</Button>
                                        <Button ref={exportOutdatedAsMdRef} onClick={() => exportOutdatedAsMd()}>复制为 Markdown</Button>
                                    </div>
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
            <div>
                <Button onClick={() => exportData()}>导出数据</Button>
            </div>
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
            缓存操作：
            <Button onClick={() => { flushCache(); }} confirm="此操作将刷新所有缓存，可能消耗较长时间。确定要刷新缓存吗？">刷新所有</Button>
            <Button onClick={() => { flushCache(["lg"]); }} confirm="此操作将刷新洛谷平台缓存，可能消耗较长时间。确定要刷新缓存吗？">刷新洛谷</Button>
            <Button onClick={() => { flushCache(["cf", "at"]); }}>刷新 CF/AT</Button>
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
                        <li><LightAnchor href="https://www.luogu.com.cn/">洛谷（自动爬取/半自动添加数据）</LightAnchor></li>
                        <li><LightAnchor href="https://codeforces.com/apiHelp">CodeForces API</LightAnchor></li>
                        <li><LightAnchor href="https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md">AtCoder Problems（第三方 API）</LightAnchor></li>
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