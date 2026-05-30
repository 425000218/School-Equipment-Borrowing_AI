// javascript/device_modal.js

// Tạo và nhúng HTML Modal toàn cục vào Document Body
function initDeviceModal() {
    if (document.getElementById('device-modal-overlay')) return;

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
}

// Global expose function (Sẵn sàng phục vụ nhiều trang)
window.openModal = function(device) {
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

window.submitModalBorrow = function() {
    const deviceId = document.getElementById('modal-btn-submit').getAttribute('data-device-id');
    const qty = document.getElementById('modal-qty').value;
    const date = document.getElementById('modal-date').value;
    
    if (qty < 1) {
        alert('Vui lòng chọn số lượng hợp lệ!');
        return;
    }
    
    alert(`🎉 Thành công! Phê duyệt mượn nội bộ:\n\n- Mã máy: ${deviceId}\n- Yêu cầu xuất: ${qty} cái\n- Hẹn nhận ngày: ${date}`);
    closeModal();
};
