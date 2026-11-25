/**
 * Date를 'YYYY-MM-DD' 형식의 문자열로 변환
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Parse 'YYYY-MM-DD' as a local date (new Date(str) would read it as UTC midnight)
 * @param {string} str
 * @returns {Date}
 */
export function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
}

/**
 * Current Korean time, shifted so the local getters (getDate, getMonth, ...) read KST.
 * The server stamps attendance dates in KST, so "today" has to be KST on any device.
 * @returns {Date}
 */
export function kstNow() {
    return new Date(Date.now() + (new Date().getTimezoneOffset() + 540) * 60000);
}

/**
 * Call `callback` when the app comes back to the front after being hidden for at least
 * `minAwayMs`: a page left open would otherwise keep showing what it loaded hours ago.
 * @param {() => void} callback
 * @param {number} [minAwayMs]
 * @returns {() => void} stops listening; hand it back from onMount
 */
export function onResume(callback, minAwayMs = 30000) {
    let hiddenAt = 0;
    const onChange = () => {
        if (document.hidden) hiddenAt = Date.now();
        else if (hiddenAt && Date.now() - hiddenAt >= minAwayMs) callback();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
}
