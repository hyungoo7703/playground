
import { GAS_URL } from './store.js';

// ==========================================
// 시간 기반 토큰 생성 (TOTP 방식)
// ==========================================
const APP_SECRET = "my_super_secret_key_2026";

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
                ...payload
            }),
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`API Error (${action}):`, error);
        return { success: false, message: error.message };
    }
}

export const api = {
    // Auth
    login: (password) => fetchFromGAS('login', { password }),

    // Ledger
    getLedger: () => fetchFromGAS('getLedger'),
    addLedger: (data) => fetchFromGAS('addLedger', data),
    updateLedger: (data) => fetchFromGAS('updateLedger', data),
    deleteLedger: (id) => fetchFromGAS('deleteLedger', { id }),
    batchAddLedger: (items) => fetchFromGAS('batchAddLedger', { items }),

    // Events
    getEvents: () => fetchFromGAS('getEvents'),
    addEvent: (data) => fetchFromGAS('addEvent', data),
    updateEvent: (data) => fetchFromGAS('updateEvent', data),

    // Rules
    getRules: () => fetchFromGAS('getRules'),
    addRule: (data) => fetchFromGAS('addRule', data),
    deleteRule: (id) => fetchFromGAS('deleteRule', { id }),

    // Foods
    getFoods: () => fetchFromGAS('getFoods'),
    addFood: (name) => fetchFromGAS('addFood', { name }),
    deleteFood: (name) => fetchFromGAS('deleteFood', { name }),

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
};
