export async function apiGet(path, opts = {}) {
    const base = window.API_BASE_URL || '';
    const res = await fetch(base + path, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        ...opts
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
    }

    return res.json();
}
