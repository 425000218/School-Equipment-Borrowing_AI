// booking/helpers.js
// Utility functions for date handling used by the booking page.

export function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

export function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function formatDM(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${d}/${m}`;
}

export function getColumnDateStr(currentMonday, dayIndex) {
    const offset = dayIndex - 2; // dayIndex 2-6 corresponds to Mon-Fri
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + offset);
    return formatYMD(d);
}
