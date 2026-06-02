// booking/ui.js
import { formatDM, formatYMD, getColumnDateStr } from './helpers.js';
import { postBooking } from './api.js';
// UI handling for the booking page – event binding, week header updates, slot selection, and rendering.

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
            currentMonday.setDate(new Date(bookingDateInput.value).getDate());
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
                const response = await postBooking(roomCode, bookingDate, slot, purpose, teacher);
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

// Helper to collect selected slot elements
export function getSelectedSlots() {
    return Array.from(document.querySelectorAll('.slot-btn.selected'));
}

// Note: formatYMD, formatDM, getColumnDateStr, postBooking are imported from other modules where needed.
