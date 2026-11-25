
import { GAS_URL, APP_SECRET } from './store.js';

// ==========================================
// 시간 기반 토큰 생성 (TOTP 방식)
// ==========================================
function generateAppToken() {
    const timeSlice = Math.floor(Date.now() / 60000); // 1분 단위
    const raw = APP_SECRET + timeSlice;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(16);
}

// A sheet cell comes back as whatever type the sheet made of it: a title of "1225" is a
// number, a settled flag may be the word "FALSE", an amount may be text with commas.
// The pages call string methods on titles and add amounts up, so the shapes are fixed
// here, once, for all of them.
const text = (v) => (v == null ? "" : String(v));
const toAmount = (v) => (typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, "")) || 0);
const isTrue = (v) => v === true || String(v).toUpperCase() === "TRUE";
const withText = (item, keys) => ({ ...item, ...Object.fromEntries(keys.map((k) => [k, text(item[k])])) });

const SHAPES = {
    ledger: (item) => ({
        ...withText(item, ["type", "title", "giver", "receiver"]),
        amount: toAmount(item.amount),
        is_settled: isTrue(item.is_settled),
    }),
    events: (item) => withText(item, ["title", "category"]),
    attendance: (item) => withText(item, ["user_name", "message"]),
    posts: (item) => withText(item, ["author", "category", "title", "content", "image_url"]),
    comments: (item) => withText(item, ["author", "content"]),
    stocks: (item) => withText(item, ["stock_name", "owner", "currency", "memo"]),
};

function normalize(result) {
    if (!result?.success) return result;
    for (const [key, shape] of Object.entries(SHAPES)) {
        if (Array.isArray(result[key])) result[key] = result[key].map(shape);
    }
    return result;
}

async function fetchFromGAS(action, payload = {}) {
    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({
                action,
                app_token: generateAppToken(),  // 모든 요청에 토큰 포함
                access_code: localStorage.getItem("accessCode"), // 서버에서 유효 코드 검증 (login 제외)
                ...payload
            }),
        });
        return normalize(await response.json());
    } catch (error) {
        console.error(`API Error (${action}):`, error);
        return { success: false, message: error.message };
    }
}

export const api = {
    // Auth
    login: (password) => fetchFromGAS('login', { password }),

    // 자주 쓰는 데이터(일정+출석+장부)를 한 번의 왕복으로
    bootstrap: () => fetchFromGAS('bootstrap'),

    // Ledger
    getLedger: () => fetchFromGAS('getLedger'),
    addLedger: (data) => fetchFromGAS('addLedger', data),
    updateLedger: (data) => fetchFromGAS('updateLedger', data),
    settleLedger: (data) => fetchFromGAS('settleLedger', data), // is_settled만 변경 (멤버 허용)
    deleteLedger: (id) => fetchFromGAS('deleteLedger', { id }),
    batchAddLedger: (items) => fetchFromGAS('batchAddLedger', { items }),

    // Events
    getEvents: () => fetchFromGAS('getEvents'),
    addEvent: (data) => fetchFromGAS('addEvent', data),
    updateEvent: (data) => fetchFromGAS('updateEvent', data),
    deleteEvent: (id) => fetchFromGAS('deleteEvent', { id }),


    // Rules
    getRules: () => fetchFromGAS('getRules'),
    addRule: (data) => fetchFromGAS('addRule', data),
    deleteRule: (id) => fetchFromGAS('deleteRule', { id }),

    // Board - Posts
    getPosts: () => fetchFromGAS('getPosts'),
    addPost: (data) => fetchFromGAS('addPost', data),
    updatePost: (data) => fetchFromGAS('updatePost', data),
    deletePost: (id) => fetchFromGAS('deletePost', { id }),
    incrementPostView: (id) => fetchFromGAS('incrementPostView', { id }),

    // Board - Comments
    getComments: (post_id) => fetchFromGAS('getComments', { post_id }),
    addComment: (data) => fetchFromGAS('addComment', data),
    deleteComment: (id) => fetchFromGAS('deleteComment', { id }),

    // Stocks
    getStocks: () => fetchFromGAS('getStocks'),
    addStock: (data) => fetchFromGAS('addStock', data),
    batchAddStock: (items) => fetchFromGAS('batchAddStock', { items }),
    deleteStock: (id) => fetchFromGAS('deleteStock', { id }),

    // Management (Roulette 등)
    getManagement: (section) => fetchFromGAS('getManagement', { section }),
    addManagement: (section, value) => fetchFromGAS('addManagement', { section, value }),
    deleteManagement: (section, value) => fetchFromGAS('deleteManagement', { section, value }),

    // Attendance
    getAttendance: () => fetchFromGAS('getAttendance'),
    addAttendance: (data) => fetchFromGAS('addAttendance', data),

    // AI Config
    getAiConfig: () => fetchFromGAS('getAiConfig'),

    // Push Notifications
    savePushDevice: (data) => fetchFromGAS('savePushDevice', data),
    sendPushNotification: (data) => fetchFromGAS('sendPushNotification', data),
    // Members may call this one: the server sends a fixed message to admins only
    notifyReward: (data) => fetchFromGAS('notifyReward', data),

    // Neon Guardian endless mode: one best wave per family member
    getGuardianRecords: () => fetchFromGAS('getGuardianRecords'),
    saveGuardianRecord: (wave) => fetchFromGAS('saveGuardianRecord', { wave }),
};



