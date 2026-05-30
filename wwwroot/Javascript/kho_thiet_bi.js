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
    const device = allDevices.find(d => d.id === id);
    if (!device) return;

    let borrowHistory = JSON.parse(localStorage.getItem('borrowHistory')) || [];
    const borrowRecord = {
        ...device,
        borrowDate: new Date().toISOString(),
    };
    borrowHistory.push(borrowRecord);
    localStorage.setItem('borrowHistory', JSON.stringify(borrowHistory));

    alert('Đã ghi nhận mượn thiết bị: ' + device.name);

    const isPersonalPage = window.location.pathname.includes('kho-ca-nhan.html');
    if (isPersonalPage) {
        let myDevices = JSON.parse(localStorage.getItem('myDevices')) || [];
        myDevices = myDevices.filter(d => d.id !== id);
        localStorage.setItem('myDevices', JSON.stringify(myDevices));

        allDevices = myDevices;
        applyFilters();
    }

    if (typeof window.renderBorrowHistorySidebar === 'function') {
        window.renderBorrowHistorySidebar();
    }
}

function handleAdd(id) {
    const device = allDevices.find(d => d.id === id);
    if (!device) return;

    let myDevices = JSON.parse(localStorage.getItem('myDevices')) || [];
    if (!myDevices.find(d => d.id === id)) {
        myDevices.push(device);
        localStorage.setItem('myDevices', JSON.stringify(myDevices));
        alert('Đã thêm thiết bị vào kho cá nhân: ' + device.name);
    } else {
        alert('Thiết bị này đã có trong kho cá nhân!');
    }
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

window.renderBorrowHistorySidebar = function () {
    const listEl = document.getElementById('borrow-history-list');
    if (!listEl) return;

    const borrowHistory = JSON.parse(localStorage.getItem('borrowHistory')) || [];
    if (borrowHistory.length === 0) {
        listEl.innerHTML = '<li style="color: #64748b; font-size: 0.9rem;">Chưa có lịch sử mượn.</li>';
        return;
    }

    const recent = [...borrowHistory].reverse().slice(0, 5);
    listEl.innerHTML = recent.map(item => {
        const dateObj = new Date(item.borrowDate);
        const date = dateObj.toLocaleDateString('vi-VN');
        const time = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        return `
            <li style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 12px; align-items: flex-start;">
                <div style="width: 44px; height: 44px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transform: scale(0.65);">
                        ${item.image}
                    </div>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1e293b; font-size: 0.95rem; line-height: 1.3; margin-bottom: 4px;">${item.name}</div>
                    <div style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${time} - ${date}
                    </div>
                </div>
            </li>
        `;
    }).join('');
};

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('equipment-grid');
    if (grid) {
        renderSkeleton();

        try {
            await new Promise(resolve => setTimeout(resolve, 600));

            const isPersonalPage = window.location.pathname.includes('kho-ca-nhan.html');

            if (isPersonalPage) {
                const stored = localStorage.getItem('myDevices');
                allDevices = stored ? JSON.parse(stored) : [];
                if (typeof window.renderBorrowHistorySidebar === 'function') {
                    window.renderBorrowHistorySidebar();
                }
            } else {
                if (!Array.isArray(window.DEVICES_DATA)) {
                    throw new Error('Thiếu dữ liệu DEVICES_DATA trong JS');
                }
                allDevices = window.DEVICES_DATA;
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
