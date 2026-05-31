// javascript/device_modal.js

// Global UI helpers: confirm modal and toast notifications
function initGlobalUI() {
    if (document.getElementById('global-confirm-overlay')) return;

    // Confirm overlay
    const cOverlay = document.createElement('div');
    cOverlay.id = 'global-confirm-overlay';
    cOverlay.className = 'global-confirm-overlay';
    cOverlay.style.display = 'none';
    cOverlay.style.position = 'fixed';
    cOverlay.style.left = '0';
    cOverlay.style.top = '0';
    cOverlay.style.right = '0';
    cOverlay.style.bottom = '0';
    cOverlay.style.background = 'rgba(2,6,23,0.6)';
    cOverlay.style.zIndex = '99998';
    cOverlay.style.alignItems = 'center';
    cOverlay.style.justifyContent = 'center';
    cOverlay.style.display = 'none';
    cOverlay.innerHTML = `
        <div class="global-confirm" id="global-confirm">
            <div class="global-confirm-body" id="global-confirm-body">Xác nhận?</div>
            <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
                <button id="global-confirm-cancel" class="modal-btn-cancel">Hủy</button>
                <button id="global-confirm-ok" class="modal-btn-confirm">Xác nhận</button>
            </div>
        </div>
    `;
    const inner = cOverlay.querySelector('#global-confirm');
    if (inner) {
        inner.style.background = '#fff';
        inner.style.padding = '16px';
        inner.style.borderRadius = '10px';
        inner.style.minWidth = '320px';
        inner.style.boxShadow = '0 8px 30px rgba(2,6,23,0.2)';
    }
    document.body.appendChild(cOverlay);

    // Toast container
    const toastContainer = document.createElement('div');
    toastContainer.id = 'global-toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.right = '16px';
    toastContainer.style.bottom = '16px';
    toastContainer.style.zIndex = '100000';
    document.body.appendChild(toastContainer);

    // Attach basic handlers
    document.getElementById('global-confirm-cancel').addEventListener('click', () => {
        cOverlay.style.display = 'none';
        if (cOverlay._resolve) cOverlay._resolve(false);
    });
    document.getElementById('global-confirm-ok').addEventListener('click', () => {
        cOverlay.style.display = 'none';
        if (cOverlay._resolve) cOverlay._resolve(true);
    });
}

// Returns a Promise<boolean>
window.showConfirm = function (message) {
    return new Promise((resolve) => {
        const cOverlay = document.getElementById('global-confirm-overlay');
        const body = document.getElementById('global-confirm-body');
        if (!cOverlay || !body) {
            // fallback to native
            resolve(window.confirm(message));
            return;
        }
        body.textContent = message;
        cOverlay.style.display = 'flex';
        cOverlay._resolve = resolve;
    });
};

window.showToast = function (message, type = 'info', timeoutMs = 3500) {
    const container = document.getElementById('global-toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `global-toast global-toast-${type}`;
    el.style.marginTop = '8px';
    el.style.minWidth = '220px';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 6px 18px rgba(2,6,23,0.08)';
    el.style.background = type === 'error' ? '#fee2e2' : (type === 'success' ? '#ecfdf5' : '#f8fafc');
    el.style.color = type === 'error' ? '#b91c1c' : (type === 'success' ? '#065f46' : '#0f172a');
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => container.removeChild(el), 300);
    }, timeoutMs);
};

// Tạo và nhúng HTML Modal toàn cục vào Document Body
function initDeviceModal() {
    if (document.getElementById('device-modal-overlay')) return;

    // Ensure global UI helpers (confirm modal + toast) exist
    initGlobalUI();

    const overlay = document.createElement('div');
    overlay.id = 'device-modal-overlay';
    overlay.className = 'device-modal-overlay';
    
    // Thu gọn popup khi nhấn vào vùng đệm màu đen bên ngoài
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    overlay.innerHTML = `
        <div class="device-modal" id="device-modal">
            <div class="modal-header">
                <h2 id="modal-title">Chi tiết thiết bị</h2>
                <button class="close-modal" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="modal-left">
                    <div class="modal-image-container" id="modal-image">
                        <!-- Image render here -->
                    </div>
                </div>
                <div class="modal-right">
                    <div class="modal-info-section">
                        <h3>Thông tin chung</h3>
                        <div class="modal-detail-row">
                            <span class="modal-detail-label">Mã thiết bị:</span>
                            <span class="modal-detail-value" id="modal-code">...</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="modal-detail-label">Danh mục:</span>
                            <span class="modal-detail-value" id="modal-category">...</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="modal-detail-label">Tình trạng:</span>
                            <span class="modal-detail-value" id="modal-status">...</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="modal-detail-label">Nhà kho:</span>
                            <span class="modal-detail-value" id="modal-stock">...</span>
                        </div>
                    </div>
                    
                    <div class="modal-info-section">
                        <h3>Mô tả chi tiết</h3>
                        <p class="modal-desc" id="modal-desc">...</p>
                    </div>

                    <div class="modal-info-section">
                        <h3>Phụ kiện đồng bộ</h3>
                        <div class="modal-accessories" id="modal-accessories">
                            <ul><li>Không có số liệu</li></ul>
                        </div>
                    </div>

                    <div class="modal-info-section" style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 0;">
                        <h3 style="border: none; margin-bottom: 15px; padding: 0;">Khởi tạo phiếu mượn</h3>
                        <div class="modal-form-group" style="margin-bottom: 12px;">
                            <label for="modal-requester">Người mượn</label>
                            <select id="modal-requester" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff;">
                                <option value="">Đang tải danh sách...</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 15px;">
                            <div class="modal-form-group" style="flex: 2;">
                                <label for="modal-date">Ngày nhận mong đợi</label>
                                <input type="date" id="modal-date" required>
                            </div>
                            <div class="modal-form-group" style="flex: 1;">
                                <label for="modal-qty">Số lượng</label>
                                <input type="number" id="modal-qty" min="1" value="1" required>
                            </div>
                        </div>
                        <div class="modal-form-group" style="margin-bottom: 0; margin-top: 10px;">
                            <label>Lịch mượn gần đây (hệ thống):</label>
                            <span style="font-size: 0.85rem; color: #10b981; font-weight: 500;" id="modal-schedule">Không có ai đặt trùng lịch hôm nay!</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn-cancel" onclick="closeModal()">Trở lại</button>
                <button class="modal-btn-confirm" id="modal-btn-submit" onclick="submitModalBorrow()">Lập phiếu mượn ngay</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    // Điền ngày hiện tại mặc định
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('modal-date');
    if (dateInput) dateInput.value = today;

    loadBorrowUsers().catch((error) => {
        console.warn('Không thể tải danh sách người mượn', error);
    });
}

async function loadBorrowUsers() {
    const select = document.getElementById('modal-requester');
    if (!select) return;

    const authUser = (window.SEBAuth && window.SEBAuth.getUser ? window.SEBAuth.getUser() : '').trim();

    const response = await fetch((window.API_BASE_URL || '') + '/api/lookups/users', {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const users = Array.isArray(data.users) ? data.users : [];

    select.innerHTML = '<option value="">Chọn người mượn</option>';
    users.forEach((user, index) => {
        const option = document.createElement('option');
        option.value = user.value;
        option.textContent = user.label;
        if (sessionStorage.getItem('seb.lastBorrowUser') === user.value) {
            option.selected = true;
        } else if (index === 0 && !select.value) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    const rememberedUser = authUser || sessionStorage.getItem('seb.lastBorrowUser');
    if (rememberedUser) {
        select.value = rememberedUser;
    }

    if (authUser) {
        // In guarded mode, requester follows the logged-in account.
        select.value = authUser;
        select.disabled = true;
    } else {
        select.disabled = false;
    }
}

// Global expose function (Sẵn sàng phục vụ nhiều trang)
window.openModal = function(device) {
    if (window.SEBAuth && !window.SEBAuth.requireAuth({ message: 'Bạn cần đăng nhập để mượn thiết bị.' })) {
        return;
    }

    initDeviceModal(); // Lazy load UI only when needed

    document.getElementById('modal-title').textContent = device.name;
    document.getElementById('modal-code').textContent = device.id;
    document.getElementById('modal-category').textContent = device.category + (device.subject && device.subject !== 'Chung' ? ` - Môn ${device.subject}` : '');
    
    // Status color
    const statusEl = document.getElementById('modal-status');
    const isAvail = device.status === 'available';
    statusEl.textContent = isAvail ? 'Sẵn sàng' : 'Không có sẵn';
    statusEl.style.color = isAvail ? '#10b981' : '#ef4444';
    
    // Số lượng (Nếu mảng JSON chưa có data mô phỏng, mix số auto random logic)
    const stock = device.quantity || Math.floor(Math.random() * 15) + 3;
    document.getElementById('modal-stock').textContent = isAvail ? `Còn ${stock} cái` : 'Đã xuất hết (0 cái)';
    
    document.getElementById('modal-image').innerHTML = device.image || '<div style="padding: 100px; text-align: center;">X</div>';

    document.getElementById('modal-desc').textContent = device.description || `Đây là thiết bị [${device.name}] được cung cấp mặc định trong kho. Đảm bảo hỗ trợ giáo viên và học sinh đáp ứng nhu cầu sử dụng thực tiễn công nghệ, an toàn và dễ sử dụng tại trường học.`;

    const accessories = device.accessories || ["Dây nguồn, hướng dẫn sử dụng", "Hộp chống sốc / Cáp tín hiệu"];
    document.getElementById('modal-accessories').innerHTML = `<ul>${accessories.map(a => `<li>${a}</li>`).join('')}</ul>`;

    // Validate Input form
    const qtyInput = document.getElementById('modal-qty');
    qtyInput.max = isAvail ? stock : 0;
    qtyInput.value = isAvail ? 1 : 0;
    
    const submitBtn = document.getElementById('modal-btn-submit');
    submitBtn.disabled = !isAvail;
    submitBtn.textContent = isAvail ? 'Tạo phiếu mượn ngay' : 'Hàng chưa về kho';
    submitBtn.setAttribute('data-device-id', device.id);

    // Kích hoạt bật hiển thị Modal
    const overlay = document.getElementById('device-modal-overlay');
    overlay.classList.add('active');
    
    // Khóa cuộn trang nền
    document.body.style.overflow = 'hidden';
};

window.closeModal = function() {
    const overlay = document.getElementById('device-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
};

window.submitModalBorrow = async function() {
    if (window.SEBAuth && !window.SEBAuth.requireAuth({ message: 'Bạn cần đăng nhập để tạo phiếu mượn.' })) {
        return;
    }

    const deviceId = document.getElementById('modal-btn-submit').getAttribute('data-device-id');
    const qty = document.getElementById('modal-qty').value;
    const date = document.getElementById('modal-date').value;
    const requesterUsername = (window.SEBAuth && window.SEBAuth.getUser ? window.SEBAuth.getUser() : '')
        || document.getElementById('modal-requester')?.value
        || '';
    
    if (!requesterUsername) {
        window.showToast('Vui lòng chọn người mượn!', 'error');
        return;
    }

    if (qty < 1) {
        window.showToast('Vui lòng chọn số lượng hợp lệ!', 'error');
        return;
    }

    const confirm = await window.showConfirm(`Xác nhận tạo phiếu mượn cho thiết bị ${deviceId} (SL: ${qty})?`);
    if (!confirm) return;

    try {
        const resp = await fetch((window.API_BASE_URL || '') + '/api/borrow-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                requesterUsername,
                deviceCode: deviceId,
                quantity: Number(qty),
                needDate: date,
                note: ''
            })
        });

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(txt || 'server_error');
        }

        const data = await resp.json();
        sessionStorage.setItem('seb.lastBorrowUser', requesterUsername);
        window.showToast(`Đã tạo phiếu mượn ${data.requestNo}`, 'success');
        closeModal();
        if (typeof window.renderBorrowHistorySidebar === 'function') {
            window.renderBorrowHistorySidebar();
        }
    } catch (err) {
        console.error(err);
        window.showToast('Tạo phiếu mượn thất bại. Vui lòng thử lại.', 'error');
    }
};
