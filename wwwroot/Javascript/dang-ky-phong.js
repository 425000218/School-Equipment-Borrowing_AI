// wwwroot/Javascript/dang-ky-phong.js
// Quản lý nghiệp vụ đặt phòng học, đồng bộ dữ liệu thời gian thực từ API

async function initBookingPage() {
    if (!document.querySelectorAll('.slot-btn').length) return; // Exit if not on this page

    // 1. Kiểm tra đăng nhập
    if (window.SEBAuth && typeof window.SEBAuth.requireAuth === 'function') {
        const loggedIn = window.SEBAuth.requireAuth({
            message: 'Bạn cần đăng nhập để xem lịch và gửi yêu cầu đăng ký phòng học.'
        });
        if (!loggedIn) return;
    }

    // 2. Định nghĩa các biến toàn cục quản lý lịch
    let currentMonday = getMonday(new Date());
    const API_BASE = window.API_BASE_URL || '';

    // Khóa học / Tiết học
    const slotButtons = document.querySelectorAll('.slot-btn');
    const submitBtn = document.querySelector('.btn-submit-booking');
    const roomTypeSelect = document.getElementById('room-type-select');
    const roomNumberSelect = document.getElementById('room-number-select');
    const bookingDateInput = document.getElementById('booking-date-input');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const currentWeekLabel = document.getElementById('current-week-label');
    const purposeTextarea = document.querySelector('.textarea-field textarea');

    // 3. Khởi chạy ban đầu
    updateWeekHeaders();
    await loadLookups();

    // 4. Các sự kiện thay đổi
    if (roomNumberSelect) {
        roomNumberSelect.addEventListener('change', fetchBookings);
    }
    if (bookingDateInput) {
        bookingDateInput.value = formatYMD(new Date());
        bookingDateInput.addEventListener('change', () => {
            if (!bookingDateInput.value) return;
            currentMonday = getMonday(new Date(bookingDateInput.value));
            updateWeekHeaders();
            fetchBookings();
        });
    }
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentMonday.setDate(currentMonday.getDate() - 7);
            if (bookingDateInput) bookingDateInput.value = formatYMD(currentMonday);
            updateWeekHeaders();
            fetchBookings();
        });
    }
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            currentMonday.setDate(currentMonday.getDate() + 7);
            if (bookingDateInput) bookingDateInput.value = formatYMD(currentMonday);
            updateWeekHeaders();
            fetchBookings();
        });
    }

    // Xử lý chọn slot (ô lịch)
    slotButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // Không cho phép bấm vào ô đã bận
            if (this.classList.contains('busy')) return;

            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                this.style.backgroundColor = '';
                this.innerText = 'Trống';
            } else {
                this.classList.add('selected');
                this.style.backgroundColor = '#4caf50'; // Màu xanh lá khi chọn
                this.innerText = 'Đã chọn';
            }
        });
    });

    // Gửi yêu cầu đặt phòng
    if (submitBtn) {
        submitBtn.addEventListener('click', async function () {
            const selectedSlots = document.querySelectorAll('.slot-btn.selected');
            const roomCode = roomNumberSelect ? roomNumberSelect.value : '';
            const purpose = purposeTextarea ? (purposeTextarea.value || '').trim() : '';

            if (!roomCode) {
                alert('Vui lòng chọn số phòng học!');
                return;
            }
            if (selectedSlots.length === 0) {
                alert('Vui lòng chọn ít nhất một tiết học trống!');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerText = 'Đang xử lý...';

            let successCount = 0;
            let errorMsg = '';

            for (const slotBtn of selectedSlots) {
                const dayIndex = parseInt(slotBtn.getAttribute('data-day-index'), 10);
                const slot = slotBtn.getAttribute('data-slot');
                const bookingDate = getColumnDateStr(dayIndex);

                try {
                    const response = await fetch(API_BASE + '/api/room-bookings', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            roomCode: roomCode,
                            bookingDate: bookingDate,
                            slot: slot,
                            purpose: purpose
                        })
                    });

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

    // 5. Các hàm hỗ trợ (Helper functions)

    // Tìm thứ 2 của tuần chứa ngày d
    function getMonday(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 0 là chủ nhật
        const monday = new Date(date.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    // Lấy chuỗi ngày YYYY-MM-DD của một cột theo dayIndex (2-6)
    function getColumnDateStr(dayIndex) {
        const offset = dayIndex - 2;
        const d = new Date(currentMonday);
        d.setDate(currentMonday.getDate() + offset);
        return formatYMD(d);
    }

    function formatYMD(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDM(date) {
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${d}/${m}`;
    }

    // Cập nhật tiêu đề ngày (T2 -> T6) và nhãn tuần hiện tại
    function updateWeekHeaders() {
        const friday = new Date(currentMonday);
        friday.setDate(currentMonday.getDate() + 4);

        if (currentWeekLabel) {
            currentWeekLabel.innerText = `${formatDM(currentMonday)} - ${formatDM(friday)} (${currentMonday.getFullYear()})`;
        }

        for (let i = 2; i <= 6; i++) {
            const el = document.getElementById(`day-${i}`);
            if (el) {
                const offset = i - 2;
                const d = new Date(currentMonday);
                d.setDate(currentMonday.getDate() + offset);
                el.innerText = `T${i} ${formatDM(d)}`;
            }
        }
    }

    // Tải danh mục dropdown từ CSDL
    async function loadLookups() {
        try {
            const resp = await fetch(API_BASE + '/api/lookups/room-booking');
            if (resp.ok) {
                const data = await resp.json();
                if (roomTypeSelect && Array.isArray(data.roomTypes)) {
                    // Xóa option cũ ngoại trừ placeholder
                    roomTypeSelect.innerHTML = '<option value="" disabled selected>Loại phòng</option>';
                    data.roomTypes.forEach(r => {
                        const o = document.createElement('option');
                        o.value = r.value;
                        o.textContent = r.label;
                        roomTypeSelect.appendChild(o);
                    });
                }
                if (roomNumberSelect && Array.isArray(data.rooms)) {
                    roomNumberSelect.innerHTML = '<option value="" disabled selected>Số phòng</option>';
                    data.rooms.forEach(r => {
                        const o = document.createElement('option');
                        o.value = r.value;
                        o.textContent = r.label;
                        roomNumberSelect.appendChild(o);
                    });
                }
            }
        } catch (e) {
            console.warn('Lỗi tải danh mục phòng', e);
        }
    }

    // Tải lịch đặt phòng hiện tại từ Server để vẽ lên bảng
    async function fetchBookings() {
        const roomCode = roomNumberSelect ? roomNumberSelect.value : '';
        if (!roomCode) {
            // Reset toàn bộ bảng về trống
            resetTimetable();
            const listContainer = document.getElementById('booking-list-content');
            if (listContainer) {
                listContainer.innerHTML = '<div style="color: #64748b; font-size: 0.95rem; text-align: center; padding: 10px;">Vui lòng chọn phòng học để xem lịch và trạng thái.</div>';
            }
            return;
        }

        const startDate = formatYMD(currentMonday);
        const friday = new Date(currentMonday);
        friday.setDate(currentMonday.getDate() + 4);
        const endDate = formatYMD(friday);

        try {
            const response = await fetch(`${API_BASE}/api/room-bookings?roomCode=${roomCode}&startDate=${startDate}&endDate=${endDate}`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Không thể tải lịch đặt phòng');
            
            const data = await response.json();
            const bookings = Array.isArray(data.bookings) ? data.bookings : [];

            // 1. Reset bảng về trạng thái trống
            resetTimetable();

            // 2. Điền lịch bận
            bookings.forEach(b => {
                // Chỉ hiển thị các trạng thái hợp lệ (bỏ qua cancelled, rejected)
                if (b.status === 'cancelled' || b.status === 'rejected') return;

                const bookingDateObj = new Date(b.bookingDate);
                const dayIndex = getDayOfWeekIndex(bookingDateObj); // 2 -> 6
                if (dayIndex < 2 || dayIndex > 6) return;

                const slot = b.slot; // e.g. Sang_T1
                const btn = document.querySelector(`.slot-btn[data-day-index="${dayIndex}"][data-slot="${slot}"]`);
                if (btn) {
                    btn.className = 'slot-btn busy';
                    btn.style.backgroundColor = '#ef4444'; // Đỏ nổi bật
                    btn.style.color = '#ffffff';
                    btn.style.cursor = 'not-allowed';
                    btn.disabled = true; // Khóa button
                    btn.innerText = 'Đã đặt';
                    
                    let hoverText = `Người đặt: ${b.requesterFullName || b.requesterUsername}`;
                    if (b.purpose) hoverText += `\nMục đích: ${b.purpose}`;
                    btn.title = hoverText;
                }
            });

            // 3. Hiển thị danh sách bên dưới
            const listContainer = document.getElementById('booking-list-content');
            if (listContainer) {
                if (bookings.length === 0) {
                    listContainer.innerHTML = '<div style="color: #64748b; font-size: 0.95rem; text-align: center; padding: 10px;">Chưa có dữ liệu phòng được đăng ký trong tuần này</div>';
                } else {
                    listContainer.innerHTML = '';
                    const currentUser = window.SEBAuth && typeof window.SEBAuth.getUser === 'function' ? window.SEBAuth.getUser() : null;
                    
                    bookings.forEach(b => {
                        const dateStr = formatDM(new Date(b.bookingDate));
                        const isMine = currentUser && (b.requesterUsername === currentUser);
                        
                        const itemDiv = document.createElement('div');
                        itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;';
                        
                        const infoDiv = document.createElement('div');
                        infoDiv.innerHTML = `
                            <div style="font-weight: 600; color: #0f172a; margin-bottom: 4px;">Phòng ${b.roomCode} - ${b.slot.replace('_', ' ')} (Ngày ${dateStr})</div>
                            <div style="font-size: 0.85rem; color: #475569;">Giáo viên: ${b.requesterFullName || b.requesterUsername} | Mục đích: ${b.purpose || 'Không có'}</div>
                        `;
                        
                        itemDiv.appendChild(infoDiv);
                        
                        if (isMine) {
                            const actionDiv = document.createElement('div');
                            const cancelBtn = document.createElement('button');
                            cancelBtn.innerText = 'Hủy';
                            cancelBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.85rem;';
                            cancelBtn.onclick = () => cancelBooking(b.bookingNo);
                            actionDiv.appendChild(cancelBtn);
                            itemDiv.appendChild(actionDiv);
                        }
                        
                        listContainer.appendChild(itemDiv);
                    });
                }
            }
        } catch (e) {
            console.error(e);
            alert('Lỗi khi tải lịch đặt phòng từ hệ thống.');
        }
    }

    async function cancelBooking(bookingNo) {
        if (!confirm('Bạn có chắc chắn muốn hủy yêu cầu đặt phòng này?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/room-bookings/${bookingNo}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ action: 'cancel', note: 'Người dùng tự hủy' })
            });
            
            if (response.ok) {
                alert('Đã hủy đặt phòng thành công!');
                fetchBookings();
            } else {
                const errData = await response.json();
                alert(`Lỗi: ${errData.error || 'Không thể hủy'}`);
            }
        } catch (e) {
            alert('Lỗi kết nối khi hủy đặt phòng.');
        }
    }

    function resetTimetable() {
        slotButtons.forEach(btn => {
            btn.className = 'slot-btn empty';
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.style.cursor = '';
            btn.disabled = false;
            btn.innerText = 'Trống';
            btn.title = '';
        });
    }

    // Lấy chỉ số thứ trong tuần: thứ 2 -> 2, thứ 3 -> 3..., thứ 6 -> 6
    function getDayOfWeekIndex(date) {
        const day = date.getDay(); // 0: Chủ nhật, 1: Thứ 2...
        if (day === 0) return 7; // Chủ nhật (không hiển thị)
        return day + 1; // 1 (Thứ 2) -> 2, 2 (Thứ 3) -> 3... 5 (Thứ 6) -> 6
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingPage);
} else {
    initBookingPage();
}
window.addEventListener('seb:page-loaded', initBookingPage);
