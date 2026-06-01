// admin.js

let currentEditUser = null;

async function initAdminPage() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return; // Exit if not on this page

    // 1. Auth check
    if (window.SEBAuth && !(await window.SEBAuth.restoreSessionFromServer())) {
        window.SEBAuth.goToLogin();
        return;
    }
    
    const role = window.SEBAuth && window.SEBAuth.getRole ? window.SEBAuth.getRole() : 'user';
    if (role !== 'admin') {
        document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:1.5rem;">Bạn không có quyền truy cập trang này.</div>';
        return;
    }

    // 2. Initial load
    loadUsers();

    // Bind modal save button only once
    const btnSaveUser = document.getElementById('btn-save-user');
    if (btnSaveUser && !btnSaveUser.dataset.hasListener) {
        btnSaveUser.dataset.hasListener = "true";
        btnSaveUser.addEventListener('click', async () => {
            if (!currentEditUser) return;
            
            const fullName = document.getElementById('um-fullname').value;
            const role = document.getElementById('um-role').value;
            const status = document.getElementById('um-status').value;
            
            try {
                const resp = await fetch((window.API_BASE_URL || '') + `/api/admin/users/${encodeURIComponent(currentEditUser)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, role, status, email: null, phone: null })
                });
                
                if (resp.ok) {
                    document.getElementById('userModal').style.display = 'none';
                    loadUsers();
                    if (window.showToast) window.showToast('Cập nhật thành công', 'success');
                } else {
                    alert('Lỗi cập nhật');
                }
            } catch(err) {
                alert('Lỗi kết nối');
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPage);
} else {
    initAdminPage();
}
window.addEventListener('seb:page-loaded', initAdminPage);

function adminSwitchTab(tabName) {
    document.querySelectorAll('.admin-nav li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));

    const tabMap = {
        'users': { li: 0, panel: 'panel-users', loader: loadUsers },
        'borrows': { li: 1, panel: 'panel-borrows', loader: loadBorrows },
        'rooms': { li: 2, panel: 'panel-rooms', loader: loadRooms }
    };

    const config = tabMap[tabName];
    if (config) {
        document.querySelectorAll('.admin-nav li')[config.li].classList.add('active');
        document.getElementById(config.panel).classList.add('active');
        config.loader();
    }
}

function getStatusBadge(status) {
    if (status === 'active') return '<span class="status-badge status-active">Hoạt động</span>';
    if (status === 'pending') return '<span class="status-badge status-pending">Chờ duyệt</span>';
    if (status === 'deleted') return '<span class="status-badge status-deleted">Khóa</span>';
    return `<span class="status-badge">${status}</span>`;
}

// =================== USERS ===================
async function loadUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = '<tr><td colspan="6">Đang tải...</td></tr>';
    
    try {
        const resp = await fetch((window.API_BASE_URL || '') + '/api/admin/users');
        if (!resp.ok) throw new Error('API failed');
        const data = await resp.json();
        
        if (!data.users || data.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Không có dữ liệu</td></tr>';
            return;
        }

        tbody.innerHTML = data.users.map(u => `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td>${u.fullName || '-'}</td>
                <td>${u.role}</td>
                <td>${getStatusBadge(u.status)}</td>
                <td>${new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                <td>
                    <button class="btn-action" onclick="openEditUser('${u.username}', '${u.fullName || ''}', '${u.role}', '${u.status}')">Sửa</button>
                    <button class="btn-action btn-danger" onclick="deleteUser('${u.username}')">Xóa</button>
                </td>
            </tr>
        `).join('');
    } catch(err) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:red">Lỗi tải danh sách người dùng</td></tr>';
    }
}

function openEditUser(username, fullName, role, status) {
    currentEditUser = username;
    document.getElementById('um-fullname').value = fullName;
    document.getElementById('um-role').value = role;
    document.getElementById('um-status').value = status;
    document.getElementById('userModalTitle').textContent = `Cập nhật User: ${username}`;
    document.getElementById('userModal').style.display = 'grid';
}

// btn-save-user listener is now bound inside initAdminPage to prevent duplication

async function deleteUser(username) {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản ${username} không?`)) return;
    
    try {
        const resp = await fetch((window.API_BASE_URL || '') + `/api/admin/users/${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });
        
        if (resp.ok) {
            loadUsers();
            if (window.showToast) window.showToast('Xóa thành công', 'success');
        } else {
            const err = await resp.json();
            alert('Lỗi xóa: ' + (err.error || 'Server error'));
        }
    } catch(err) {
        alert('Lỗi kết nối');
    }
}

// =================== BORROWS ===================
async function loadBorrows() {
    const tbody = document.getElementById('admin-borrows-tbody');
    tbody.innerHTML = '<tr><td colspan="6">Đang tải...</td></tr>';
    
    try {
        const resp = await fetch((window.API_BASE_URL || '') + '/api/admin/borrow-requests');
        if (!resp.ok) throw new Error('API failed');
        const data = await resp.json();
        
        if (!data.requests || data.requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Không có dữ liệu</td></tr>';
            return;
        }

        tbody.innerHTML = data.requests.map(r => `
            <tr>
                <td><strong>${r.requestNo}</strong></td>
                <td>${r.requesterFullName || r.requesterUsername}</td>
                <td>${r.device?.name || r.deviceCode} (SL: ${r.quantity || 1})</td>
                <td>${getStatusBadge(r.status)}</td>
                <td>${new Date(r.createdAt).toLocaleString('vi-VN')}</td>
                <td>
                    ${r.status === 'pending' ? `
                        <button class="btn-action" style="color:#166534; border-color:#bbf7d0;" onclick="updateBorrowStatus(${r.id}, 'approved')">Duyệt</button>
                        <button class="btn-action btn-danger" onclick="updateBorrowStatus(${r.id}, 'rejected')">Từ chối</button>
                    ` : ''}
                    ${r.status === 'approved' ? `
                        <button class="btn-action" style="color:#0284c7; border-color:#bae6fd;" onclick="updateBorrowStatus(${r.id}, 'returned')">Đã trả</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    } catch(err) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:red">Lỗi tải phiếu mượn</td></tr>';
    }
}

async function updateBorrowStatus(id, status) {
    if (!confirm(`Bạn muốn chuyển trạng thái thành ${status}?`)) return;
    try {
        const resp = await fetch((window.API_BASE_URL || '') + `/api/admin/borrow-requests/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status, handledNote: '' })
        });
        if (resp.ok) {
            loadBorrows();
            if (window.showToast) window.showToast('Cập nhật thành công', 'success');
        } else alert('Lỗi cập nhật');
    } catch(err) { alert('Lỗi kết nối'); }
}

// =================== ROOMS ===================
async function loadRooms() {
    const tbody = document.getElementById('admin-rooms-tbody');
    tbody.innerHTML = '<tr><td colspan="6">Đang tải...</td></tr>';
    
    try {
        const resp = await fetch((window.API_BASE_URL || '') + '/api/admin/room-bookings');
        if (!resp.ok) throw new Error('API failed');
        const data = await resp.json();
        
        if (!data.bookings || data.bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Không có dữ liệu</td></tr>';
            return;
        }

        tbody.innerHTML = data.bookings.map(b => `
            <tr>
                <td><strong>${b.bookingNo}</strong></td>
                <td>${b.requesterFullName || b.requesterUsername}</td>
                <td>${b.roomName || b.roomCode}</td>
                <td>Tiết ${b.slot} - ${new Date(b.bookingDate).toLocaleDateString('vi-VN')}</td>
                <td>${getStatusBadge(b.status)}</td>
                <td>
                    ${b.status === 'pending' ? `
                        <button class="btn-action" style="color:#166534; border-color:#bbf7d0;" onclick="updateRoomStatus(${b.id}, 'approved')">Duyệt</button>
                        <button class="btn-action btn-danger" onclick="updateRoomStatus(${b.id}, 'rejected')">Từ chối</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    } catch(err) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:red">Lỗi tải lịch phòng</td></tr>';
    }
}

async function updateRoomStatus(id, status) {
    if (!confirm(`Bạn muốn chuyển trạng thái thành ${status}?`)) return;
    try {
        const resp = await fetch((window.API_BASE_URL || '') + `/api/admin/room-bookings/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status, handledNote: '' })
        });
        if (resp.ok) {
            loadRooms();
            if (window.showToast) window.showToast('Cập nhật thành công', 'success');
        } else alert('Lỗi cập nhật');
    } catch(err) { alert('Lỗi kết nối'); }
}
