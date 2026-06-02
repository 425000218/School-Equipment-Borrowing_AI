// booking/init.js
// Entry point for the booking page. Sets up UI, loads data, and binds events.

import { loadLookups, fetchBookings, postBooking } from './api.js';
import { updateWeekHeaders, bindSlotButtons, bindNavigation, bindSubmit, getSelectedSlots, renderBookingList, applyBookingsToUI } from './ui.js';
import { getMonday, formatYMD, formatDM, getColumnDateStr } from './helpers.js';

export async function initBookingPage() {
    // Guard: ensure we are on the correct page
    if (!document.querySelectorAll('.slot-btn').length) return;

    // Global state
    let currentMonday = getMonday(new Date());
    const API_BASE = window.API_BASE_URL || '';

    // DOM elements
    const slotButtons = document.querySelectorAll('.slot-btn');
    const submitBtn = document.querySelector('.btn-submit-booking');
    const roomTypeSelect = document.getElementById('room-type-select');
    const roomNumberSelect = document.getElementById('room-number-select');
    const teacherSelect = document.getElementById('teacher-select');
    const bookingDateInput = document.getElementById('booking-date-input');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const currentWeekLabel = document.getElementById('current-week-label');
    const purposeTextarea = document.querySelector('.textarea-field textarea');

    // Initial UI setup
    updateWeekHeaders(currentMonday, currentWeekLabel);
    if (bookingDateInput) bookingDateInput.value = formatYMD(new Date());
    bindSlotButtons(slotButtons);
    bindNavigation(prevWeekBtn, nextWeekBtn, bookingDateInput, currentMonday, () => updateWeekHeaders(currentMonday, currentWeekLabel), loadBookings);
    bindSubmit(submitBtn, getSelectedSlots, roomNumberSelect, teacherSelect, purposeTextarea, loadBookings, currentMonday);

    // Load dropdowns then initial bookings
    await loadLookups(roomTypeSelect, roomNumberSelect, teacherSelect);
    await loadBookings();

    async function loadBookings() {
        const bookings = await fetchBookings(roomNumberSelect ? roomNumberSelect.value : '', currentMonday);
        const listContainer = document.getElementById('booking-list-content');
        renderBookingList(listContainer, bookings);
        applyBookingsToUI(bookings, currentMonday);
    }
}
