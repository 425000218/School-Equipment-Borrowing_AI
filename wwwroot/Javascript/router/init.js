// router/init.js
// Handles navigation event listeners, active nav state, and page‑specific init registry.

export function updateNavActiveState(url) {
    const pathname = new URL(url, window.location.origin).pathname;
    const navLinks = document.querySelectorAll('.nav-tab');
    navLinks.forEach(link => {
        const linkPath = new URL(link.getAttribute('href'), window.location.origin).pathname;
        if (pathname.endsWith(linkPath) || (linkPath === '/' && pathname.endsWith('index.html'))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Page‑specific init map – can be extended by other modules.
export const pageInitMap = {
    '/Page/dang-ky-phong-hoc.html': () => {
        if (typeof window.initBookingPage === 'function') {
            window.initBookingPage();
        }
    },
    // add other pages here
};

export function runPageInit(url) {
    const path = new URL(url, window.location.origin).pathname;
    if (pageInitMap[path]) {
        try {
            pageInitMap[path]();
        } catch (e) {
            console.warn('PJAX page‑init failed for', path, e);
        }
    }
}

export function registerNavHandlers() {
    // Click handling for PJAX navigation
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a.nav-tab');
        if (!link) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        const targetUrl = new URL(href, window.location.href);
        if (targetUrl.origin !== window.location.origin) return;
        e.preventDefault();
        // loadPage will be imported from core.js at runtime via global SEBRouter
        window.SEBRouter.loadPage(targetUrl.pathname + targetUrl.search + targetUrl.hash, true);
    });
    // Back/forward navigation
    window.addEventListener('popstate', function () {
        window.SEBRouter.loadPage(window.location.href, false);
    });
}
