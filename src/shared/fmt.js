// SPDX-License-Identifier: GPL-3.0-or-later

import { formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";

/** @param {Platform} platform */
function fmtPlatformName(platform) {
    if (platform === "at") return "AtCoder";
    if (platform === "cf") return "CodeForces";
    if (platform === "lg") return "洛谷";
    if (platform === "uoj") return "UOJ";
    if (platform === "qoj") return "QOJ";
    return "Unknown Platform";
}

/** @param {number} t */
function fmtTimeStamp(t) {
    return formatDistanceToNowStrict(new Date(t), { addSuffix: true, includeSeconds: true, locale: zhCN });
}

export { fmtPlatformName, fmtTimeStamp };