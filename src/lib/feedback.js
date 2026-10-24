import { writable } from "svelte/store";

// In-app replacements for alert()/confirm(); rendered once by MainLayout

export const toasts = writable([]);
let nextId = 0;

// type: "success" | "error" | "info"; longer messages stay up longer
export function toast(message, type = "info", duration = Math.max(2800, message.length * 70)) {
  const id = ++nextId;
  toasts.update((list) => [...list, { id, message, type }]);
  setTimeout(
    () => toasts.update((list) => list.filter((t) => t.id !== id)),
    duration,
  );
}

export const confirmState = writable(null);

export function confirmDialog(message, { confirmText = "확인", danger = false } = {}) {
  return new Promise((resolve) => {
    confirmState.set({ message, confirmText, danger, resolve });
  });
}
