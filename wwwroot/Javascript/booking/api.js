// booking/api.js
// API interaction functions for the booking page.

import { formatYMD } from './helpers.js';

export function renderBookingList(container, bookings) {
    if (!container) return;
    container.innerHTML = '';
    if (!bookings || bookings.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = '#64748b';
        empty.style.fontSize = '0.95rem';
        empty.style.textAlign = 'center';
        empty.style.padding = '10px';
        empty.textContent = 'Chưa có dữ liệu phòng được chọn';
        container.appendChild(empty);
        return;
    }
    bookings.forEach(b => {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.borderBottom = '1px solid #e2e8f0';
        // Expected booking object: {roomCode, bookingDate, slot, purpose, teacher}
        const dateStr = b.bookingDate || '';
        const slotStr = b.slot || '';
        const room = b.roomCode || '';
        const purpose = b.purpose || '';
        const teacher = b.teacher || '';
        item.innerHTML = `<strong>Phòng ${room}</strong> - ${dateStr} - ${slotStr}<br/>Mục đích: ${purpose}<br/>Giáo viên: ${teacher}`;
        container.appendChild(item);
    });
}

export async function loadLookups(roomTypeSelect, roomNumberSelect, teacherSelect) {
    // Example static data; replace with real API calls if available
    const roomTypes = ['Lý thuyết', 'Thực hành'];
    const roomsByType = {
        'Lý thuyết': ['101', '102', '103'],
        'Thực hành': ['201', '202', '203']
    };

    // Populate room type select
    if (roomTypeSelect) {
        roomTypeSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.textContent = 'Loại phòng';
        roomTypeSelect.appendChild(placeholder);
        roomTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = type;
            roomTypeSelect.appendChild(opt);
        });
        // When type changes, update room numbers
        roomTypeSelect.addEventListener('change', () => {
            const selected = roomTypeSelect.value;
            const numbers = roomsByType[selected] || [];
            if (roomNumberSelect) {
                roomNumberSelect.innerHTML = '';
                const ph = document.createElement('option');
                ph.value = '';
                ph.disabled = true;
                ph.selected = true;
                ph.textContent = 'Số phòng';
                roomNumberSelect.appendChild(ph);
                numbers.forEach(num => {
                    const o = document.createElement('option');
                    o.value = num;
                    o.textContent = num;
                    roomNumberSelect.appendChild(o);
                });
            }
        });
    }
    // Teacher select placeholder (static list)
    if (teacherSelect) {
        teacherSelect.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.disabled = true;
        ph.selected = true;
        ph.textContent = 'Giáo viên';
        teacherSelect.appendChild(ph);
        ['GV. Nguyễn Văn A', 'GV. Trần Thị B', 'GV. Lê C'].forEach(t => {
            const o = document.createElement('option');
            o.value = t;
            o.textContent = t;
            teacherSelect.appendChild(o);
        });
    }
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
