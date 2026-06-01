// user_dashboard.js

async function initUserDashboard() {
    const tbody = document.getElementById('my-borrows-tbody');
    if (!tbody) return; // Exit if not on this page

    // 1. Restore session & setup UI
    if (window.SEBAuth) {
        window.SEBAuth.restoreSessionFromServer().then(isLoggedIn => {
            if (!isLoggedIn) {
                window.SEBAuth.goToLogin();
                return;
            }
            loadUserProfile();
            loadMyBorrows();
            loadMyBookings();
        });
    }

    // 2. Profile Update Logic
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Optional: call update profile API
            if (window.SEBUI) window.SEBUI.showToast('Chức năng cập nhật hồ sơ đang được hoàn thiện!', 'info');
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserDashboard);
} else {
    initUserDashboard();
}
window.addEventListener('seb:page-loaded', initUserDashboard);

function loadUserProfile() {
    const user = window.SEBAuth.getUser();
    if (!user) return;
    
    document.getElementById('prof-username').value = user.username || '';
    document.getElementById('prof-fullname').value = user.fullName || '';
    
    const sidebarName = document.getElementById('sidebar-fullname');
    const sidebarRole = document.getElementById('sidebar-role');
    if (sidebarName) sidebarName.innerText = user.fullName || user.username;
    if (sidebarRole) sidebarRole.innerText = (user.role === 'admin' ? 'Quản trị viên' : 'Giáo viên');
    
    // email and phone can be fetched from a /profile API if it returns them
}

function getStatusBadge(status) {
    if (status === 'pending') return '<span style="background:#fef08a; color:#854d0e; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">Chờ duyệt</span>';
    if (status === 'approved') return '<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">Đã duyệt</span>';
    if (status === 'rejected') return '<span style="background:#fecdd3; color:#9f1239; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">Từ chối</span>';
    if (status === 'returned') return '<span style="background:#e5e7eb; color:#374151; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">Đã trả</span>';
    if (status === 'cancelled') return '<span style="background:#cbd5e1; color:#334155; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">Đã thu hồi</span>';
    return status;
}

async function loadMyBorrows() {
    const tbody = document.getElementById('my-borrows-tbody');
    try {
        const resp = await fetch((window.API_BASE_URL || '') + '/api/user/borrow-requests');
        if (!resp.ok) throw new Error('Lỗi lấy dữ liệu');
        const data = await resp.json();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:15px; text-align:center;">Bạn chưa mượn thiết bị nào.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(item => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:10px;">${item.requestNo}</td>
                <td style="padding:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${item.deviceImageUrl ? `<img src="${item.deviceImageUrl}" width="40" height="40" style="border-radius:4px; object-fit:cover;">` : ''}
                        <span>${item.deviceName || item.deviceCode}</span>
                    </div>
                </td>
                <td style="padding:10px;">${item.quantity}</td>
                <td style="padding:10px;">${new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                <td style="padding:10px;">${getStatusBadge(item.status)}</td>
                <td style="padding:10px;">
                    ${item.status === 'pending' ? `<button onclick="cancelBorrow(${item.id})" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-undo"></i> Thu hồi</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:15px; text-align:center; color:red;">Lỗi tải dữ liệu.</td></tr>';
    }
}

async function loadMyBookings() {
    const tbody = document.getElementById('my-bookings-tbody');
    try {
        const resp = await fetch((window.API_BASE_URL || '') + '/api/user/room-bookings');
        if (!resp.ok) throw new Error('Lỗi lấy dữ liệu');
        const data = await resp.json();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:15px; text-align:center;">Bạn chưa đặt phòng nào.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(item => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:10px;">${item.bookingNo}</td>
                <td style="padding:10px;">${item.roomName || item.roomCode}</td>
                <td style="padding:10px;">${new Date(item.bookingDate).toLocaleDateString('vi-VN')}</td>
                <td style="padding:10px;">${item.slot}</td>
                <td style="padding:10px;">${getStatusBadge(item.status)}</td>
                <td style="padding:10px;">
                    ${item.status === 'pending' ? `<button onclick="cancelBooking(${item.id})" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-undo"></i> Thu hồi</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:15px; text-align:center; color:red;">Lỗi tải dữ liệu.</td></tr>';
    }
}

window.cancelBorrow = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn thu hồi yêu cầu mượn thiết bị này?')) return;
    try {
        const resp = await fetch((window.API_BASE_URL || '') + `/api/user/borrow-requests/${id}/cancel`, { method: 'PUT' });
        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Lỗi hệ thống');
        }
        if (window.SEBUI) window.SEBUI.showToast('Thu hồi thành công!', 'success');
        loadMyBorrows();
    } catch (e) {
        if (window.SEBUI) window.SEBUI.showToast(e.message, 'error');
    }
};

window.cancelBooking = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn thu hồi lịch đặt phòng này?')) return;
    try {
        const resp = await fetch((window.API_BASE_URL || '') + `/api/user/room-bookings/${id}/cancel`, { method: 'PUT' });
        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Lỗi hệ thống');
        }
        if (window.SEBUI) window.SEBUI.showToast('Thu hồi thành công!', 'success');
        loadMyBookings();
    } catch (e) {
        if (window.SEBUI) window.SEBUI.showToast(e.message, 'error');
    }
};
