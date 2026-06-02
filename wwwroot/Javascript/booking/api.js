// booking/api.js
// API interaction functions for the booking page.

import { formatYMD } from './helpers.js';

/**
 * Fetch lookup data (room types, rooms per type, teachers).
 * Currently returns static data; replace with real API calls as needed.
 */
export async function fetchLookups() {
    const roomTypes = ['Lý thuyết', 'Thực hành'];
    const roomsByType = {
        'Lý thuyết': ['101', '102', '103'],
        'Thực hành': ['201', '202', '203']
    };
    const teachers = ['GV. Nguyễn Văn A', 'GV. Trần Thị B', 'GV. Lê C'];
    return { roomTypes, roomsByType, teachers };
}

/**
 * Retrieve bookings for a given room and week.
 * @param {string} roomCode - Room identifier (may be empty for all rooms).
 * @param {Date} currentMonday - Monday of the week to query.
 * @returns {Promise<Array>} List of booking objects.
 */
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

/**
 * Post a new booking request.
 */
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
