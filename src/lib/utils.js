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
