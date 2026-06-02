// booking/api.js
// API interaction functions for the booking page.

import { formatYMD } from './helpers.js';

export async function loadLookups(roomTypeSelect, roomNumberSelect) {
    // Example placeholder: populate selects; real implementation would fetch from server.
    // For now, assume static options are already in HTML.
    return Promise.resolve();
}

export async function fetchBookings(roomCode, currentMonday) {
    const API_BASE = window.API_BASE_URL || '';
    const startDate = formatYMD(currentMonday);
    const endDate = formatYMD(new Date(currentMonday.getTime() + 4 * 24 * 60 * 60 * 1000)); // Monday + 4 days
    const url = `${API_BASE}/api/room-bookings?room=${encodeURIComponent(roomCode)}&from=${startDate}&to=${endDate}`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
        console.warn('Failed to fetch bookings', response.status);
        return [];
    }
    return response.json();
}

export async function postBooking(roomCode, bookingDate, slot, purpose) {
    const API_BASE = window.API_BASE_URL || '';
    const response = await fetch(`${API_BASE}/api/room-bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ roomCode, bookingDate, slot, purpose })
    });
    return response;
}
