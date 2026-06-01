/* =========================================
   UI/UX IMPROVEMENTS JS
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. DARK MODE TOGGLE ---
    const savedTheme = localStorage.getItem('seb_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Tạo nút toggle dark mode
    const navRight = document.querySelector('.header-right');
    if (navRight) {
        const themeBtn = document.createElement('button');
        themeBtn.className = 'theme-toggle-btn';
        themeBtn.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
        themeBtn.title = 'Chuyển chế độ giao diện';
        
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('seb_theme', newTheme);
            themeBtn.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
        });
        
        navRight.insertBefore(themeBtn, navRight.firstChild);
    }
    
    // --- 2. GLOBAL TOAST SYSTEM ---
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);

    window.showToast = function(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : '⚠️');
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Trigger reflow for animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // --- 3. CUSTOM CONFIRM MODAL ---
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'custom-modal-backdrop';
    modalBackdrop.innerHTML = `
        <div class="custom-modal">
            <div class="custom-modal-title" id="custom-modal-title">Xác nhận</div>
            <div class="custom-modal-message" id="custom-modal-message">Bạn có chắc chắn?</div>
            <div class="custom-modal-actions">
                <button class="btn-modal btn-modal-cancel" id="custom-modal-cancel">Hủy</button>
                <button class="btn-modal btn-modal-confirm" id="custom-modal-confirm">Đồng ý</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalBackdrop);

    window.showConfirm = function(title, message, onConfirm) {
        document.getElementById('custom-modal-title').innerText = title;
        document.getElementById('custom-modal-message').innerText = message;
        
        const btnCancel = document.getElementById('custom-modal-cancel');
        const btnConfirm = document.getElementById('custom-modal-confirm');
        
        // Remove old listeners by replacing elements
        const newCancel = btnCancel.cloneNode(true);
        const newConfirm = btnConfirm.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        
        modalBackdrop.classList.add('show');
        
        newCancel.addEventListener('click', () => {
            modalBackdrop.classList.remove('show');
        });
        
        newConfirm.addEventListener('click', () => {
            modalBackdrop.classList.remove('show');
            if(onConfirm) onConfirm();
        });
    };
});
