// SPDX-License-Identifier: GPL-3.0-or-later

/** @param {Platform} platform */
function fmtPlatformName(platform) {
    if (platform === "at") return "AtCoder";
    if (platform === "cf") return "CodeForces";
    if (platform === "lg") return "洛谷";
    if (platform === "uoj") return "UOJ";
    if (platform === "qoj") return "QOJ";
    return "Unknown Platform";
}

export { fmtPlatformName };