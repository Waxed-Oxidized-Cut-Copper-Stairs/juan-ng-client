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

function error(...obj) {
    console.groupCollapsed(`%c${fmtShortDate()} %c[错误]`, "color: #66ccff", "color: red", obj[0]);
    for (let i = 1; i < obj.length; ++i)
        console.log(obj[i]);
    console.log(`时间 %c${fmtDate()}`, "color: #66ccff");
    console.trace();
    console.groupEnd();
}
function warning(...obj) {
    console.groupCollapsed(`%c${fmtShortDate()} %c[警告]`, "color: #66ccff", "color: yellow", obj[0]);
    for (let i = 1; i < obj.length; ++i)
        console.log(obj[i]);
    console.log(`时间 %c${fmtDate()}`, "color: #66ccff");
    console.trace();
    console.groupEnd();
}

export { error, warning };
