(function () {
    const AUTH_USER_KEY = 'seb.authUser';
    const AUTH_ROLE_KEY = 'seb.authRole';
    const AUTH_FULLNAME_KEY = 'seb.authFullName';
    const PROFILE_PATH = '/Page/kho-ca-nhan.html';
    const LOGIN_PATH = '/Page/dang-nhap.html';

    function dispatchAuthChanged() {
        window.dispatchEvent(new CustomEvent('seb:auth-changed', {
            detail: {
                isLoggedIn: isLoggedIn(),
                user: getUser(),
                role: getRole(),
                fullName: getFullName()
            }
        }));
    }

    function getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    function setSession(user, role, remember, fullName) {
        const safeUser = (user || '').trim();
        const safeRole = (role || 'user').trim().toLowerCase();
        const safeFullName = (fullName || '').trim();

        if (!safeUser) return;

        sessionStorage.setItem(AUTH_USER_KEY, safeUser);
        sessionStorage.setItem(AUTH_ROLE_KEY, safeRole);
        sessionStorage.setItem(AUTH_FULLNAME_KEY, safeFullName);

        // Keep compatibility with existing feature code
        sessionStorage.setItem('seb.lastBorrowUser', safeUser);
        if (safeRole === 'admin' || safeRole === 'approver') {
            sessionStorage.setItem('seb.borrowActorUser', safeUser);
        }

        if (remember) {
            localStorage.setItem(AUTH_USER_KEY, safeUser);
            localStorage.setItem(AUTH_ROLE_KEY, safeRole);
            localStorage.setItem(AUTH_FULLNAME_KEY, safeFullName);
        } else {
            localStorage.removeItem(AUTH_USER_KEY);
            localStorage.removeItem(AUTH_ROLE_KEY);
            localStorage.removeItem(AUTH_FULLNAME_KEY);
        }

        dispatchAuthChanged();
    }

    function clearSession() {
        sessionStorage.removeItem(AUTH_USER_KEY);
        sessionStorage.removeItem(AUTH_ROLE_KEY);
        sessionStorage.removeItem(AUTH_FULLNAME_KEY);
        sessionStorage.removeItem('seb.lastBorrowUser');
        sessionStorage.removeItem('seb.borrowActorUser');

        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_ROLE_KEY);
        localStorage.removeItem(AUTH_FULLNAME_KEY);

        dispatchAuthChanged();
    }

    function getUser() {
        return sessionStorage.getItem(AUTH_USER_KEY)
            || localStorage.getItem(AUTH_USER_KEY)
            || '';
    }

    function getRole() {
        return sessionStorage.getItem(AUTH_ROLE_KEY)
            || localStorage.getItem(AUTH_ROLE_KEY)
            || 'user';
    }

    function getFullName() {
        return sessionStorage.getItem(AUTH_FULLNAME_KEY)
            || localStorage.getItem(AUTH_FULLNAME_KEY)
            || '';
    }

    function isLoggedIn() {
        return !!getUser();
    }

    function buildLoginRedirectUrl() {
        const current = window.location.pathname + window.location.search;
        return LOGIN_PATH + '?redirect=' + encodeURIComponent(current);
    }

    function goToLogin() {
        window.location.href = buildLoginRedirectUrl();
    }

    function requireAuth(options) {
        if (isLoggedIn()) {
            return true;
        }

        const message = options && options.message
            ? options.message
            : 'Bạn cần đăng nhập để tiếp tục.';

        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            window.alert(message);
        }

        goToLogin();
        return false;
    }

    async function login(username, password, remember) {
        const response = await fetch((window.API_BASE_URL || '') + '/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password, remember: !!remember })
        });

        if (!response.ok) {
            let errorPayload = null;
            let rawText = null;
            try {
                rawText = await response.text();
                try {
                    errorPayload = JSON.parse(rawText || 'null');
                } catch {
                    errorPayload = null;
                }
            } catch {
                rawText = null;
            }

            return {
                ok: false,
                status: response.status,
                error: errorPayload && errorPayload.error ? errorPayload.error : null,
                attemptsRemaining: errorPayload && typeof errorPayload.attemptsRemaining === 'number'
                    ? errorPayload.attemptsRemaining
                    : null,
                retryAfterSeconds: errorPayload && typeof errorPayload.retryAfterSeconds === 'number'
                    ? errorPayload.retryAfterSeconds
                    : null,
                rawBody: rawText
            };
        }

        const payload = await response.json();
        const user = payload && payload.user ? payload.user : null;
        if (!user || !user.username) {
            return { ok: false, status: 500 };
        }

        setSession(user.username, user.role || 'user', !!remember, user.fullName || '');
        return { ok: true, user };
    }

    async function restoreSessionFromServer() {
        try {
            const response = await fetch((window.API_BASE_URL || '') + '/api/auth/session', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                clearSession();
                return false;
            }

            const payload = await response.json();
            const user = payload && payload.user ? payload.user : null;
            if (!user || !user.username) {
                clearSession();
                return false;
            }

            setSession(user.username, user.role || 'user', true, user.fullName || '');
            return true;
        } catch (error) {
            console.warn('Không thể kiểm tra session từ server', error);
            return isLoggedIn();
        }
    }

    async function logout() {
        try {
            await fetch((window.API_BASE_URL || '') + '/api/auth/logout', {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Logout API thất bại', error);
        }

        clearSession();
    }

    function updateHeaderButton(button, iconClass, label, href, onClick) {
        if (!button) return;

        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.title = label;
        button.innerHTML = `<i class="${iconClass}"></i>`;

        button.onclick = async function () {
            if (typeof onClick === 'function') {
                await onClick();
                return;
            }

            window.location.href = href;
        };
    }

    function syncAuthUi() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        const buttons = headerRight.querySelectorAll('.icon-btn');
        const userButton = buttons[0] || null;
        const actionButton = buttons[1] || null;

        const loggedIn = isLoggedIn();
        const user = getUser();
        const fullName = getFullName();
        const role = getRole();

        updateHeaderButton(
            userButton,
            loggedIn ? 'fa-solid fa-circle-user' : 'far fa-user',
            loggedIn
                ? `Hồ sơ ${fullName || user}`
                : 'Đăng nhập',
            loggedIn ? PROFILE_PATH : LOGIN_PATH
        );

        updateHeaderButton(
            actionButton,
            loggedIn ? 'fa-solid fa-right-from-bracket' : 'fas fa-pencil-alt',
            loggedIn
                ? `Đăng xuất ${fullName || user}`
                : 'Đăng nhập hệ thống',
            loggedIn ? LOGIN_PATH : LOGIN_PATH
        , async function () {
            if (loggedIn) {
                await logout();
                window.location.href = LOGIN_PATH;
            } else {
                window.location.href = LOGIN_PATH;
            }
        });

        let statusChip = headerRight.querySelector('.seb-auth-status');
        if (!statusChip) {
            statusChip = document.createElement('div');
            statusChip.className = 'seb-auth-status';
            statusChip.style.fontSize = '0.8rem';
            statusChip.style.padding = '4px 8px';
            statusChip.style.borderRadius = '12px';
            statusChip.style.marginLeft = '8px';
            statusChip.style.fontWeight = '600';
            headerRight.appendChild(statusChip);
        }

        if (loggedIn) {
            statusChip.style.display = 'block';
            statusChip.style.backgroundColor = role === 'admin' ? '#fef08a' : '#dcfce7';
            statusChip.style.color = role === 'admin' ? '#854d0e' : '#166534';
            statusChip.textContent = role === 'admin' ? 'QTV' : 'GV';
        } else {
            statusChip.style.display = 'none';
        }

        // Inject Admin Navigation Link
        const navLinks = document.getElementById('navLinks');
        if (navLinks) {
            let adminTab = navLinks.querySelector('.admin-nav-tab');
            if (loggedIn && role === 'admin') {
                if (!adminTab) {
                    adminTab = document.createElement('a');
                    adminTab.href = '/Page/admin.html';
                    adminTab.className = 'nav-tab admin-nav-tab';
                    adminTab.style.color = '#e11d48';
                    adminTab.style.fontWeight = 'bold';
                    adminTab.innerHTML = '<i class="fas fa-user-shield"></i> Trang quản trị';
                    navLinks.appendChild(adminTab);
                }
            } else {
                if (adminTab) adminTab.remove();
            }
        }
    }

    function redirectAfterLogin(defaultPath) {
        const redirect = getQueryParam('redirect');
        if (redirect && redirect.startsWith('/')) {
            window.location.href = redirect;
            return;
        }
        window.location.href = defaultPath || PROFILE_PATH;
    }

    async function bootstrapAuthUi() {
        await restoreSessionFromServer();
        syncAuthUi();
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootstrapAuthUi, { once: true });
        } else {
            bootstrapAuthUi();
        }
    }

    window.SEBAuth = {
        setSession,
        getUser,
        getRole,
        getFullName,
        isLoggedIn,
        requireAuth,
        login,
        restoreSessionFromServer,
        logout,
        syncAuthUi,
        goToLogin,
        redirectAfterLogin
    };
})();
