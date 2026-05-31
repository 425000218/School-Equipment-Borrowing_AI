(function () {
    const AUTH_USER_KEY = 'seb.authUser';
    const AUTH_ROLE_KEY = 'seb.authRole';
    const AUTH_FULLNAME_KEY = 'seb.authFullName';

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
        return '/Page/dang-nhap.html?redirect=' + encodeURIComponent(current);
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
            try {
                errorPayload = await response.json();
            } catch {
                errorPayload = null;
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
                    : null
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

    function redirectAfterLogin(defaultPath) {
        const redirect = getQueryParam('redirect');
        if (redirect && redirect.startsWith('/')) {
            window.location.href = redirect;
            return;
        }
        window.location.href = defaultPath || '/index.html';
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
        goToLogin,
        redirectAfterLogin
    };
})();
