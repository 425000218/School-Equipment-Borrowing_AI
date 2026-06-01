// wwwroot/Javascript/router.js
// Bộ định tuyến PJAX giúp chuyển đổi các tab mượt mà không chớp trắng tải lại trang

(function () {
    const API_BASE = window.API_BASE_URL || '';

    // Khởi tạo các hàm xử lý
    function executeScripts(container) {
        if (!container) return;
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            // Copy attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            if (oldScript.src) {
                newScript.src = oldScript.src;
            } else {
                newScript.textContent = oldScript.textContent;
            }
            // Thay thế script cũ để thực thi
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    async function loadPage(url, pushState = true) {
        try {
            const currentWrapper = document.querySelector('.section-wrapper');
            if (currentWrapper) {
                currentWrapper.classList.add('fade-out');
                // Đợi hiệu ứng fade-out (150ms)
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            const response = await fetch(url);
            if (!response.ok) {
                window.location.href = url; // Fallback nếu tải qua Ajax lỗi
                return;
            }

            const htmlText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');

            // 1. Kiểm tra xác thực ngay trước khi vẽ DOM mới (để tránh chớp trắng lộ giao diện)
            const targetHead = doc.querySelector('head');
            
            // Nạp động các stylesheet mới từ trang đích vào <head> hiện tại để tránh lỗi mất CSS
            if (targetHead) {
                const targetStylesheets = targetHead.querySelectorAll('link[rel="stylesheet"]');
                targetStylesheets.forEach(link => {
                    const linkHref = link.getAttribute('href');
                    if (linkHref) {
                        // Phân giải URL tương đối của stylesheet so với URL trang đích
                        const resolvedHref = new URL(linkHref, new URL(url, window.location.origin)).href;
                        
                        // Kiểm tra xem stylesheet này đã tồn tại trong head chưa
                        const exists = Array.from(document.querySelectorAll('head link[rel="stylesheet"]')).some(el => el.href === resolvedHref);
                        if (!exists) {
                            const newLink = document.createElement('link');
                            newLink.rel = 'stylesheet';
                            newLink.href = resolvedHref;
                            document.head.appendChild(newLink);
                        }
                    }
                });
            }

            const hasAuthCheck = targetHead && targetHead.innerHTML.includes('Immediate Auth Check');
            if (hasAuthCheck) {
                if (!sessionStorage.getItem('seb.authUser') && !localStorage.getItem('seb.authUser')) {
                    const pathname = new URL(url, window.location.origin).pathname;
                    const redirectUrl = '/Page/dang-nhap.html?redirect=' + encodeURIComponent(pathname);
                    loadPage(redirectUrl, true);
                    return;
                }
            }

            // 2. Thay thế section-wrapper
            const newWrapper = doc.querySelector('.section-wrapper');
            const activeWrapper = document.querySelector('.section-wrapper');

            if (newWrapper && activeWrapper) {
                newWrapper.classList.add('fade-in');
                activeWrapper.parentNode.replaceChild(newWrapper, activeWrapper);
            }

            // 3. Cập nhật Title
            const newTitle = doc.querySelector('title');
            if (newTitle) {
                document.title = newTitle.textContent;
            }

            // 4. Cập nhật URL trình duyệt
            if (pushState) {
                history.pushState(null, '', url);
            }

            // 5. Cập nhật trạng thái active trên navbar
            updateNavActiveState(url);

            // 5.5. RELOAD config.js ĐẦU TIÊN để API_BASE_URL được tái thiết lập
            // (Quan trọng: config.js phải chạy trước tất cả scripts khác)
            const configScript = document.querySelector('script[src*="config.js"]');
            if (configScript) {
                configScript.remove();
            }
            await new Promise(resolve => {
                const newConfigScript = document.createElement('script');
                newConfigScript.src = '/Javascript/config.js?v=' + Date.now(); // Cache buster
                newConfigScript.onload = resolve;
                newConfigScript.onerror = resolve; // Tiếp tục dù có lỗi
                document.head.appendChild(newConfigScript);
            });

            // 6. Chạy các thẻ script động
            if (newWrapper) {
                executeScripts(newWrapper);
            }

            // Tìm và chạy các scripts ở body của trang mới
            const bodyScripts = doc.querySelectorAll('body script');
            bodyScripts.forEach(oldScript => {
                if (oldScript.src && oldScript.src.includes('router.js')) return;
                if (oldScript.src && oldScript.src.includes('config.js')) return; // Skip config.js vì đã load rồi

                const scriptSrc = oldScript.getAttribute('src');
                if (scriptSrc) {
                    // Loại bỏ script cũ cùng tên (nếu có) để nạp lại
                    const existing = document.querySelector(`script[src="${scriptSrc}"]`);
                    if (existing && !existing.src.includes('config.js')) {
                        existing.remove();
                    }
                    const newScript = document.createElement('script');
                    newScript.src = scriptSrc;
                    document.body.appendChild(newScript);
                } else {
                    const newScript = document.createElement('script');
                    newScript.textContent = oldScript.textContent;
                    document.body.appendChild(newScript);
                }
            });

            // 7. Phát sự kiện seb:page-loaded để tái khởi tạo JS
            window.dispatchEvent(new CustomEvent('seb:page-loaded', { detail: { url } }));

            // Đồng bộ UI đăng nhập nếu có hệ thống Auth
            if (window.SEBAuth && typeof window.SEBAuth.syncAuthUi === 'function') {
                window.SEBAuth.syncAuthUi();
            }

        } catch (error) {
            console.error('PJAX error, loading page standard:', error);
            window.location.href = url;
        }
    }

    function updateNavActiveState(url) {
        const pathname = new URL(url, window.location.origin).pathname;
        const navLinks = document.querySelectorAll('.nav-tab');
        navLinks.forEach(link => {
            const linkPath = new URL(link.getAttribute('href'), window.location.origin).pathname;
            // So sánh trùng khớp tương đối
            if (pathname.endsWith(linkPath) || (linkPath === '/' && pathname.endsWith('index.html'))) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // Lắng nghe sự kiện click trên các thẻ nav-tab
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a.nav-tab');
        if (!link) return;

        // Bỏ qua các click đặc biệt
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        const targetUrl = new URL(href, window.location.href);
        if (targetUrl.origin !== window.location.origin) return;

        e.preventDefault();
        loadPage(targetUrl.pathname + targetUrl.search + targetUrl.hash, true);
    });

    // Lắng nghe sự kiện Back/Forward của trình duyệt
    window.addEventListener('popstate', function () {
        loadPage(window.location.href, false);
    });

    // Xuất ra global
    window.SEBRouter = {
        loadPage
    };
})();
