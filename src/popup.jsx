// SPDX-License-Identifier: GPL-3.0-or-later

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushCache } from "./protocol_v2.js";
import { Button } from "./components/Generic";
import styles from "./popup.module.css";

const versionName = `${__JUAN_VERSION__} (${__COMMIT_HASH__})`;

export default function Popup() {
    return (
        <>
            <header className={styles.header}>
                <div className={styles.title}>联考水表机</div>
                <div>版本 {versionName}</div>
                <div>React {__REACT_VERSION__}, Vite {__VITE_VERSION__}</div>
            </header>
            <main className={styles.main}>
                <div className={styles.operation}>
                    <div>
                        如果遇到重大故障或数据库混乱，刷新缓存无法恢复的，请尝试：在浏览器扩展管理页面，检查扩展视图，选择 Application 页签的 IndexDB 选项，删除其下的三个数据库。
                    </div>
                    <div>
                        <Button onClick={() => { flushCache(); }} confirm="此操作将刷新所有缓存，可能消耗较长时间。确定要刷新缓存吗？">刷新所有缓存</Button>
                        <Button onClick={() => { flushCache(["lg"]); }} confirm="此操作将刷新洛谷平台缓存，可能消耗较长时间。确定要刷新缓存吗？">刷新洛谷</Button>
                        <Button onClick={() => { flushCache(["cf", "at"]); }}>刷新 CF/AT</Button>
                    </div>
                </div>
                <div>
                    本插件与洛谷、CodeForces 和 AtCoder 官方无任何关联。
                    <br />
                    数据来源：
                    <ul>
                        <li><a href="https://www.luogu.com.cn/" target="_blank">洛谷（直接爬取）</a></li>
                        <li><a href="https://codeforces.com/apiHelp" target="_blank">CodeForces API</a></li>
                        <li><a href="https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md" target="_blank">AtCoder Problems（第三方 API）</a></li>
                    </ul>
                </div>
            </main>
            <footer className={styles.footer}>
                <strong>Copyright (c) 2026 bluewindde</strong>
                <br />
                不含任何担保
                <br />
                详见 <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank">GNU General Public License, version 3 or later</a>
                <br />
                遇到问题，请汇报到 <a href="mailto:bluewindde@163.com" target="_blank">mailto:bluewindde@163.com</a>
            </footer>
        </>
    )
}

createRoot(document.getElementById("app")).render(
    <StrictMode>
        <Popup />
    </StrictMode>
);