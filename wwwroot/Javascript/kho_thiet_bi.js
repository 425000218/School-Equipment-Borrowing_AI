// javascript/kho_thiet_bi.js

let allDevices = [];
let filteredDevices = [];
let currentPage = 1;
const itemsPerPage = 8;

function renderCard(device) {
    const isUnavailable = device.status === 'unavailable';
    const statusText = isUnavailable ? 'Bảo trì / Hết hàng' : 'Sẵn sàng';
    const statusClass = isUnavailable ? 'unavailable' : 'available';

    // Disable button attributes
    const btnState = isUnavailable ? 'disabled' : '';
    const btnText = isUnavailable ? 'Chờ nhập kho' : 'Mượn';

    const isPersonalPage = window.location.pathname.includes('kho-ca-nhan.html');
    let actionsHtml = '';

    if (isPersonalPage) {
        actionsHtml = `<button class="btn-borrow" style="width: 100%; margin: 0; display: block;" ${btnState} onclick="handleBorrow('${device.id}')">${btnText}</button>`;
    } else {
        actionsHtml = `
            <button class="btn-borrow" ${btnState} onclick="handleBorrow('${device.id}')">${btnText}</button>
            <button class="btn-add" onclick="handleAdd('${device.id}')">Thêm</button>
        `;
    }

    return `
        <div class="device-card" 
             data-name="${device.name}" 
             data-category="${device.category}" 
             data-subject="${device.subject || ''}"
             data-status="${device.status}">
            <div class="device-image" style="cursor: pointer;" onclick="window.openDeviceModalById('${device.id}')" title="Nhấn để xem cấu hình chi tiết">${device.image}</div>
            <div class="device-info">
                <h3 style="cursor: pointer; color: #2563eb; transition: color 0.2s;" onmouseover="this.style.color='#1d4ed8'" onmouseout="this.style.color='#2563eb'" onclick="window.openDeviceModalById('${device.id}')" title="Nhấn để xem cấu hình chi tiết">${device.name}</h3>
                <p><strong>Mã TB:</strong> ${device.id}</p>
                <p><strong>Môn học:</strong> ${device.subject || 'Chung'}</p>
                <p><strong>Trạng thái:</strong> <span class="status ${statusClass}">${statusText}</span></p>
            </div>
            <div class="device-actions">
                ${actionsHtml}
            </div>
        </div>
    `;
}

function handleBorrow(id) {
    if (typeof window.openDeviceModalById === 'function') {
        window.openDeviceModalById(id);
        return;
    }

    const device = allDevices.find(d => d.id === id);
    if (!device) return;

    if (window.showToast) window.showToast('Không mở được modal mượn cho: ' + device.name, 'error');
}

function handleAdd(id) {
    const device = allDevices.find(d => d.id === id);
    if (!device) return;

    // Try to add via API (username from sessionStorage)
    const username = sessionStorage.getItem('seb.lastBorrowUser') || '';
    if (!username) {
        if (window.showToast) window.showToast('Vui lòng chọn người mượn trước khi thêm kho cá nhân.', 'error');
        return;
    }

    (async () => {
        try {
            const resp = await fetch((window.API_BASE_URL || '') + '/api/me/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ username, deviceCode: id })
            });
            if (!resp.ok) throw new Error(await resp.text());
            const data = await resp.json();
            if (data.added) {
                if (window.showToast) window.showToast('Đã thêm thiết bị vào kho cá nhân: ' + device.name, 'success');
                if (typeof window.renderPersonalDevices === 'function') window.renderPersonalDevices();
            } else {
                if (window.showToast) window.showToast('Thiết bị đã tồn tại trong kho cá nhân.', 'info');
            }
        } catch (err) {
            console.error(err);
            if (window.showToast) window.showToast('Không thêm được thiết bị vào kho cá nhân.', 'error');
        }
    })();
}

function handleRemove(id) {
    const username = sessionStorage.getItem('seb.lastBorrowUser') || '';
    if (!username) {
        if (window.showToast) window.showToast('Vui lòng chọn người mượn trước khi thao tác.', 'error');
        return;
    }

    (async () => {
        try {
            const resp = await fetch((window.API_BASE_URL || '') + `/api/me/favorites/${encodeURIComponent(id)}?username=${encodeURIComponent(username)}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });
            if (!resp.ok) throw new Error(await resp.text());
            const data = await resp.json();
            if (data.deleted && data.deleted > 0) {
                if (window.showToast) window.showToast('Đã xóa thiết bị khỏi kho cá nhân.', 'success');
                if (typeof window.renderPersonalDevices === 'function') window.renderPersonalDevices();
            } else {
                if (window.showToast) window.showToast('Không tìm thấy thiết bị trong kho cá nhân.', 'info');
            }
        } catch (err) {
            console.error(err);
            if (window.showToast) window.showToast('Không xóa được thiết bị.', 'error');
        }
    })();
}

function renderPage(page) {
    const grid = document.getElementById('equipment-grid');
    if (!grid) return;

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredDevices.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        // Giao diện Khôn tìm thấy kết quả
        grid.innerHTML = `
            <div class="empty-state">
                <h3>Không có kết quả</h3>
                <p>Không tìm thấy thiết bị nào khớp với từ khóa tìm kiếm hoặc bộ lọc.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = pageData.map(d => renderCard(d)).join('');
}

function renderPagination() {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    if (currentPage > 1) {
        html += `<button class="page-btn prev" onclick="goToPage(${currentPage - 1})">Prev</button>`;
    } else {
        html += `<button class="page-btn prev" disabled>Prev</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        const activeClass = (i === currentPage) ? 'active' : '';
        html += `<button class="page-btn ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (currentPage < totalPages) {
        html += `<button class="page-btn next" onclick="goToPage(${currentPage + 1})">Next</button>`;
    } else {
        html += `<button class="page-btn next" disabled>Next</button>`;
    }

    container.innerHTML = html;
}

window.goToPage = function (page) {
    const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderPage(currentPage);
        renderPagination();

        const searchBar = document.getElementById('search-input');
        if (searchBar) {
            window.scrollTo({
                top: searchBar.offsetTop - 50,
                behavior: 'smooth'
            });
        }
    }
};

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function setupFilters() {
    const checkboxes = document.querySelectorAll('.filter-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            applyFilters();
        });
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            applyFilters();
        }, 300));
    }

    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) filterCategory.addEventListener('change', applyFilters);

    const filterSubject = document.getElementById('filter-subject');
    if (filterSubject) filterSubject.addEventListener('change', applyFilters);
}

async function resolveDeviceCatalog() {
    if (window.DEVICES_DATA_PROMISE && typeof window.DEVICES_DATA_PROMISE.then === 'function') {
        const devices = await window.DEVICES_DATA_PROMISE;
        if (Array.isArray(devices)) {
            return devices;
        }
    }

    if (Array.isArray(window.DEVICES_DATA)) {
        return window.DEVICES_DATA;
    }

    return [];
}

function applyFilters() {
    const checkedBoxes = Array.from(document.querySelectorAll('.filter-checkbox:checked'));
    let selectedCategories = checkedBoxes.filter(cb => cb.dataset.type === 'category').map(cb => cb.value);
    let selectedSubjects = checkedBoxes.filter(cb => cb.dataset.type === 'subject').map(cb => cb.value);

    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filterCategory = document.getElementById('filter-category');
    if (filterCategory && filterCategory.value) {
        selectedCategories.push(filterCategory.value);
    }

    const filterSubject = document.getElementById('filter-subject');
    if (filterSubject && filterSubject.value) {
        selectedSubjects.push(filterSubject.value);
    }

    filteredDevices = allDevices.filter(device => {
        const matchCategory = selectedCategories.length === 0 || selectedCategories.includes(device.category);
        const matchSubject = selectedSubjects.length === 0 || selectedSubjects.includes(device.subject);
        const matchSearch = searchTerm === '' || device.name.toLowerCase().includes(searchTerm);

        return matchCategory && matchSubject && matchSearch;
    });

    currentPage = 1;
    renderPage(currentPage);
    renderPagination();
}

function renderSkeleton() {
    const grid = document.getElementById('equipment-grid');
    if (!grid) return;

    // Sinh HTML placeholder của 8 skeleton form tương ứng với itemsPerPage
    const skeletonHTML = Array(8).fill(`
        <div class="skeleton-card">
            <div class="skeleton-shimmer skeleton-img"></div>
            <div class="skeleton-shimmer skeleton-text title"></div>
            <div class="skeleton-shimmer skeleton-text"></div>
            <div class="skeleton-shimmer skeleton-text short"></div>
            <div class="skeleton-actions">
                <div class="skeleton-shimmer skeleton-btn"></div>
                <div class="skeleton-shimmer skeleton-btn"></div>
            </div>
        </div>
    `).join('');

    grid.innerHTML = skeletonHTML;
}

function getBorrowStatusLabel(status) {
    switch (status) {
        case 'pending': return 'Chờ duyệt';
        case 'approved': return 'Đã duyệt';
        case 'rejected': return 'Từ chối';
        case 'checked_out': return 'Đã xuất kho';
        case 'returned': return 'Đã trả';
        default: return status || 'Không rõ';
    }
}

function getBorrowActionButtons(status, requestNo) {
    if (!requestNo) return '';

    const buttonStyle = 'padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.75rem; background: #fff; color: #334155; cursor: pointer;';
    const makeBtn = (action, label) => `<button class="borrow-action-btn" data-action="${action}" data-request="${requestNo}" style="${buttonStyle}">${label}</button>`;

    switch (status) {
        case 'pending':
            return `${makeBtn('approve', 'Duyệt')} ${makeBtn('reject', 'Từ chối')}`;
        case 'approved':
            return makeBtn('checkout', 'Xuất kho');
        case 'checked_out':
            return makeBtn('return', 'Đã trả');
        default:
            return '';
    }
}

async function applyBorrowRequestAction(requestNo, action) {
    const actorSelect = document.getElementById('borrow-actor-select');
    const actorUsername = actorSelect ? actorSelect.value : '';

    const response = await fetch((window.API_BASE_URL || '') + `/api/borrow-requests/${encodeURIComponent(requestNo)}/actions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            action,
            actorUsername: actorUsername || null,
            note: ''
        })
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}

function bindBorrowHistoryActions() {
    const listEl = document.getElementById('borrow-history-list');
    if (!listEl || listEl.dataset.bound === '1') {
        return;
    }

    listEl.dataset.bound = '1';
    listEl.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains('borrow-action-btn')) {
            return;
        }

        const requestNo = target.dataset.request;
        const action = target.dataset.action;
        if (!requestNo || !action) {
            return;
        }

        // Ask for confirmation first
        let confirmMessage = 'Xác nhận thực hiện thao tác?';
        switch (action) {
            case 'approve': confirmMessage = 'Xác nhận duyệt phiếu mượn này?'; break;
            case 'reject': confirmMessage = 'Xác nhận từ chối phiếu mượn này?'; break;
            case 'checkout': confirmMessage = 'Xác nhận xuất kho cho phiếu này?'; break;
            case 'return': confirmMessage = 'Xác nhận đã nhận trả thiết bị?'; break;
        }

        const proceed = window.showConfirm ? await window.showConfirm(confirmMessage) : window.confirm(confirmMessage);
        if (!proceed) return;

        const oldText = target.textContent;
        target.disabled = true;
        target.textContent = 'Đang xử lý...';

        try {
            await applyBorrowRequestAction(requestNo, action);
            if (typeof window.renderBorrowHistorySidebar === 'function') {
                window.renderBorrowHistorySidebar();
            }
            if (window.showToast) window.showToast('Cập nhật trạng thái thành công', 'success');
        } catch (error) {
            console.error(error);
            if (window.showToast) window.showToast('Không cập nhật được trạng thái phiếu mượn.', 'error');
            target.disabled = false;
            target.textContent = oldText;
        }
    });
}

window.renderBorrowHistorySidebar = function () {
    const listEl = document.getElementById('borrow-history-list');
    if (!listEl) return;

    const userSelect = document.getElementById('borrow-user-select');
    const requesterUsername = (userSelect && userSelect.value) || sessionStorage.getItem('seb.lastBorrowUser') || '';

    if (!requesterUsername) {
        listEl.innerHTML = '<li style="color: #64748b; font-size: 0.9rem;">Chọn người mượn để xem lịch sử.</li>';
        return;
    }

    listEl.innerHTML = '<li style="color: #64748b; font-size: 0.9rem;">Đang tải lịch sử mượn...</li>';

    fetch((window.API_BASE_URL || '') + `/api/borrow-requests?requesterUsername=${encodeURIComponent(requesterUsername)}`, {
        headers: { 'Accept': 'application/json' }
    })
        .then(async (resp) => {
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            return resp.json();
        })
        .then((data) => {
            const requests = Array.isArray(data.requests) ? data.requests : [];
            if (requests.length === 0) {
                listEl.innerHTML = '<li style="color: #64748b; font-size: 0.9rem;">Chưa có phiếu mượn nào.</li>';
                return;
            }

            listEl.innerHTML = requests.slice(0, 5).map((item) => {
                const dateObj = new Date(item.createdAt);
                const date = dateObj.toLocaleDateString('vi-VN');
                const time = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const statusLabel = getBorrowStatusLabel(item.status);
                const actionButtons = getBorrowActionButtons(item.status, item.requestNo);
                return `
                    <li style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 12px; align-items: flex-start;">
                        <div style="width: 44px; height: 44px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transform: scale(0.65);">
                                ${item.device?.imageUrl ? `<img src="${item.device.imageUrl}" alt="${item.device.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />` : ''}
                            </div>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1e293b; font-size: 0.95rem; line-height: 1.3; margin-bottom: 4px;">${item.device?.name || 'Thiết bị'}</div>
                            <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 2px;">Phiếu: ${item.requestNo} · SL: ${item.device?.quantity || 1} · ${statusLabel}</div>
                            <div style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 4px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                ${time} - ${date}
                            </div>
                            ${actionButtons ? `<div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">${actionButtons}</div>` : ''}
                        </div>
                    </li>
                `;
            }).join('');

            bindBorrowHistoryActions();
        })
        .catch((error) => {
            console.error(error);
            listEl.innerHTML = '<li style="color: #ef4444; font-size: 0.9rem;">Không tải được lịch sử mượn.</li>';
        });
};

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('equipment-grid');
    if (grid) {
        renderSkeleton();

        try {
            const isPersonalPage = window.location.pathname.includes('kho-ca-nhan.html');

            // Load lookups (categories + subjects) from API
            try {
                const resp = await fetch((window.API_BASE_URL || '') + '/api/lookups/device-filters');
                if (resp.ok) {
                    const data = await resp.json();
                    // categories -> render checkboxes
                    const catContainer = document.getElementById('category-filters');
                    if (catContainer && Array.isArray(data.categories)) {
                        catContainer.innerHTML = data.categories.map(c => `\n                            <div class="filter-group kho-filter-group">\n                                <label class="kho-filter-label">\n                                    <input type="checkbox" class="filter-checkbox kho-filter-checkbox" value="${c.value}" data-type="category"> ${c.label}\n                                </label>\n                            </div>`).join('');
                    }
                    // subjects -> render checkboxes
                    const subjContainer = document.getElementById('subject-filters');
                    if (subjContainer && Array.isArray(data.subjects)) {
                        subjContainer.innerHTML = data.subjects.map(s => `\n                            <div class="filter-group kho-filter-group">\n                                <label class="kho-filter-label">\n                                    <input type="checkbox" class="filter-checkbox kho-filter-checkbox" value="${s.value}" data-type="subject"> ${s.label}\n                                </label>\n                            </div>`).join('');
                    }
                }
            } catch (e) {
                console.warn('Không thể tải lookup categories/subjects', e);
            }

            if (isPersonalPage) {
                // Load personal devices from API
                const username = sessionStorage.getItem('seb.lastBorrowUser') || '';
                if (!username) {
                    allDevices = [];
                } else {
                    try {
                        const resp = await fetch((window.API_BASE_URL || '') + `/api/me/favorites?username=${encodeURIComponent(username)}`);
                        if (resp.ok) {
                            const payload = await resp.json();
                            allDevices = Array.isArray(payload.devices) ? payload.devices.map(d => ({
                                id: d.id,
                                name: d.name,
                                category: d.category,
                                subject: d.subject,
                                status: 'available',
                                quantity: d.quantity,
                                image: d.imageUrl ? `<img src="${d.imageUrl}" alt="${d.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#94a3b8">Không có ảnh</div>'
                            })) : [];
                        } else {
                            allDevices = [];
                        }
                    } catch (e) {
                        console.error('Không tải được kho cá nhân', e);
                        allDevices = [];
                    }
                }
                if (typeof window.renderBorrowHistorySidebar === 'function') {
                    window.renderBorrowHistorySidebar();
                }
            } else {
                allDevices = await resolveDeviceCatalog();
            }

            applyFilters();
            setupFilters();
        } catch (err) {
            console.error('Lỗi khi tải danh sách thiết bị:', err);
            grid.innerHTML = '<div class="empty-state" style="border-color: #ef4444; color: #ef4444;"><h3>Lỗi tải dữ liệu</h3><p>Không tìm thấy dữ liệu thiết bị trong file JS.</p></div>';
        }
    }
});

// Hàm Bridge để tương tác chéo giúp mở Modal cho thiết bị
window.openDeviceModalById = function (id) {
    const device = allDevices.find(d => d.id === id);
    if (device && typeof window.openModal === 'function') {
        window.openModal(device);
    } else {
        console.warn("Hệ thống cảnh báo: Modal Component chưa tải kịp hoặc mã ID bị sai!");
    }
};
