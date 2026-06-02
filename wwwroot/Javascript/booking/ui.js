// booking/ui.js
import { formatDM, formatYMD, getColumnDateStr } from './helpers.js';
import { postBooking } from './api.js';

/** UI handling for the booking page – event binding, week header updates, slot selection, rendering, and lookups. */

// Initialize dropdowns (room type, room number, teacher)
export function initLookups(roomTypeSelect, roomNumberSelect, teacherSelect) {
    // Static data (could be fetched via API)
    const roomTypes = ['Lý thuyết', 'Thực hành'];
    const roomsByType = {
        'Lý thuyết': ['101', '102', '103'],
        'Thực hành': ['201', '202', '203']
    };
    const teachers = ['GV. Nguyễn Văn A', 'GV. Trần Thị B', 'GV. Lê C'];

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
    // Teacher select
    if (teacherSelect) {
        teacherSelect.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.disabled = true;
        ph.selected = true;
        ph.textContent = 'Giáo viên';
        teacherSelect.appendChild(ph);
        teachers.forEach(t => {
            const o = document.createElement('option');
            o.value = t;
            o.textContent = t;
            teacherSelect.appendChild(o);
        });
    }
}

export function updateWeekHeaders(currentMonday, currentWeekLabel) {
    const friday = new Date(currentMonday);
    friday.setDate(currentMonday.getDate() + 4);
    if (currentWeekLabel) {
        currentWeekLabel.innerText = `${formatDM(currentMonday)} - ${formatDM(friday)} (${currentMonday.getFullYear()})`;
    }
    // Update day headers (Tue-Sat)
    for (let i = 2; i <= 6; i++) {
        const dayElem = document.getElementById(`day-${i}`);
        if (dayElem) {
            const date = new Date(currentMonday);
            date.setDate(currentMonday.getDate() + (i - 2));
            dayElem.innerText = `T${i} ${formatYMD(date)}`;
        }
    }
}

export function bindSlotButtons(slotButtons) {
    slotButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.classList.contains('busy')) return;
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                this.style.backgroundColor = '';
                this.innerText = 'Trống';
            } else {
                this.classList.add('selected');
                this.style.backgroundColor = '#4caf50';
                this.innerText = 'Đã chọn';
            }
        });
    });
}

export function bindNavigation(prevWeekBtn, nextWeekBtn, bookingDateInput, currentMonday, updateHeaders, fetchBookings) {
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentMonday.setDate(currentMonday.getDate() - 7);
            if (bookingDateInput) bookingDateInput.value = formatYMD(currentMonday);
            updateHeaders();
            fetchBookings();
        });
    }
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            currentMonday.setDate(currentMonday.getDate() + 7);
            if (bookingDateInput) bookingDateInput.value = formatYMD(currentMonday);
            updateHeaders();
            fetchBookings();
        });
    }
    if (bookingDateInput) {
        bookingDateInput.addEventListener('change', () => {
            if (!bookingDateInput.value) return;
            const newDate = new Date(bookingDateInput.value);
            currentMonday.setDate(newDate.getDate());
            currentMonday.setMonth(newDate.getMonth());
            currentMonday.setFullYear(newDate.getFullYear());
            updateHeaders();
            fetchBookings();
        });
    }
}

export function bindSubmit(submitBtn, getSelectedSlots, roomNumberSelect, teacherSelect, purposeTextarea, fetchBookings, currentMonday) {
    if (!submitBtn) return;
    submitBtn.addEventListener('click', async function () {
        const selectedSlots = getSelectedSlots();
        const roomCode = roomNumberSelect ? roomNumberSelect.value : '';
        const teacher = teacherSelect ? teacherSelect.value : '';
        const purpose = purposeTextarea ? (purposeTextarea.value || '').trim() : '';
        if (!roomCode) { alert('Vui lòng chọn số phòng học!'); return; }
        if (!teacher) { alert('Vui lòng chọn giáo viên!'); return; }
        if (selectedSlots.length === 0) { alert('Vui lòng chọn ít nhất một tiết học trống!'); return; }
        submitBtn.disabled = true;
        submitBtn.innerText = 'Đang xử lý...';
        let successCount = 0;
        let errorMsg = '';
        for (const slotBtn of selectedSlots) {
            const dayIndex = parseInt(slotBtn.getAttribute('data-day-index'), 10);
            const slot = slotBtn.getAttribute('data-slot');
            const bookingDate = getColumnDateStr(currentMonday, dayIndex);
            try {
                const response = await postBooking(roomCode, bookingDate, slot, purpose);
                if (response.ok) {
                    successCount++;
                } else {
                    const errData = await response.json();
                    errorMsg = errData.error || 'Lỗi không xác định';
                }
            } catch (e) {
                errorMsg = 'Không thể kết nối đến máy chủ';
            }
        }
        submitBtn.disabled = false;
        submitBtn.innerText = 'Gửi Yêu Cầu';
        if (successCount === selectedSlots.length) {
            alert(`Đăng ký thành công ${successCount} tiết học phòng ${roomCode}!`);
            if (purposeTextarea) purposeTextarea.value = '';
            await fetchBookings();
        } else {
            alert(`Đăng ký thất bại. Thành công ${successCount}/${selectedSlots.length}. Lỗi: ${errorMsg}`);
            await fetchBookings();
        }
    });
}

export function getSelectedSlots() {
    return Array.from(document.querySelectorAll('.slot-btn.selected'));
}

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
        const dateStr = b.bookingDate || '';
        const slotStr = b.slot || '';
        const room = b.roomCode || '';
        const purpose = b.purpose || '';
        const teacher = b.teacher || '';
        item.innerHTML = `<strong>Phòng ${room}</strong> - ${dateStr} - ${slotStr}<br/>Mục đích: ${purpose}<br/>Giáo viên: ${teacher}`;
        container.appendChild(item);
    });
}

export function applyBookingsToUI(bookings, currentMonday) {
    const slotButtons = document.querySelectorAll('.slot-btn');
    slotButtons.forEach(btn => {
        if (btn.classList.contains('busy')) {
            btn.classList.remove('busy');
            btn.style.backgroundColor = '';
            btn.innerText = 'Trống';
        }
        if (btn.classList.contains('selected')) {
            btn.classList.remove('selected');
            btn.style.backgroundColor = '';
            btn.innerText = 'Trống';
        }
    });
    bookings.forEach(b => {
        if (!b.bookingDate || !b.slot) return;
        const bookingDate = new Date(b.bookingDate);
        const diffDays = Math.floor((bookingDate - currentMonday) / (1000 * 60 * 60 * 24));
        const dayIndex = diffDays + 2;
        const selector = `.slot-btn[data-day-index="${dayIndex}"][data-slot="${b.slot}"]`;
        const btn = document.querySelector(selector);
        if (btn) {
            btn.classList.add('busy');
            btn.style.backgroundColor = '#ef4444';
            btn.innerText = 'Đã đặt';
        }
    });
}
