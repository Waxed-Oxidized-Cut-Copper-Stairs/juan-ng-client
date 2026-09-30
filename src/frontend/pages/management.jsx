// SPDX-License-Identifier: GPL-3.0-or-later

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

export default function Main() {
    return (
        <>
            管理页面
        </>
    )
}

createRoot(document.getElementById("app")).render(
    <StrictMode>
        <Main />
    </StrictMode>
);