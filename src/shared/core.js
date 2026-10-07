// SPDX-License-Identifier: GPL-3.0-or-later

/** @param {Date | null} date */
function fmtDate(date = null) {
    if (date === null) date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = (date.getDate()).toString().padStart(2, "0");
    const hours = (date.getHours()).toString().padStart(2, "0");
    const minutes = (date.getMinutes()).toString().padStart(2, "0");
    const seconds = (date.getSeconds()).toString().padStart(2, "0");
    const milliseconds = (date.getMilliseconds()).toString().padStart(3, "0");
    const offset = date.getTimezoneOffset() / 60;
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} (${offset > 0 ? `UTC-${offset}` : `UTC+${-offset}`})`;
}
/** @param {Date | null} date */
function fmtShortDate(date = null) {
    if (date === null) date = new Date();
    const hours = (date.getHours()).toString().padStart(2, "0");
    const minutes = (date.getMinutes()).toString().padStart(2, "0");
    const seconds = (date.getSeconds()).toString().padStart(2, "0");
    const milliseconds = (date.getMilliseconds()).toString().padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/** @param {string} reporter */
function error(reporter, headline, ...details) {
    console.groupCollapsed(`%c${fmtShortDate()} %c[${reporter}] %c[ERROR]`, "color: #005555", "color: #3465a4", "color: #cc0000", headline);
    for (const obj of details)
        console.log(obj);
    console.log(`%c${fmtDate()}`, "color: #005555");
    console.trace();
    console.groupEnd();
}
/** @param {string} reporter */
function warning(reporter, headline, ...details) {
    console.groupCollapsed(`%c${fmtShortDate()} %c[${reporter}] %c[WARNING]`, "color: #005555", "color: #3465a4", "color: #c4a000", headline);
    for (const obj of details)
        console.log(obj);
    console.log(`%c${fmtDate()}`, "color: #005555");
    console.trace();
    console.groupEnd();
}
/** @param {string} reporter */
function log(reporter, headline, ...details) {
    console.groupCollapsed(`%c${fmtShortDate()} %c[${reporter}]`, "color: #005555", "color: #3465a4", headline);
    for (const obj of details)
        console.log(obj);
    console.log(`%c${fmtDate()}`, "color: #005555");
    console.trace();
    console.groupEnd();
}

/**
 * 休眠至少 t 毫秒
 * @param {number} t
 */
async function sleep(t) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export { error, warning, log, sleep };
