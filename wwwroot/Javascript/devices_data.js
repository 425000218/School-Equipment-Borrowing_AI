(() => {
    const escapeHtml = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const buildImageHtml = (device) => {
        const imageUrl = device.imageUrl || device.image_url || '';
        const altText = escapeHtml(device.name || device.id || 'Thiết bị');

        if (!imageUrl) {
            return '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #94a3b8; font-size: 0.9rem;">Không có ảnh</div>';
        }

        return `<img src="${imageUrl}" alt="${altText}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`;
    };

    const normalizeDevice = (device) => ({
        ...device,
        imageUrl: device.imageUrl || device.image_url || '',
        image: buildImageHtml(device)
    });

    const loadDevices = async () => {
        const base = window.API_BASE_URL || '';
        const response = await fetch(base + '/api/devices', {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const payload = await response.json();
        const devices = Array.isArray(payload.devices) ? payload.devices.map(normalizeDevice) : [];
        window.DEVICES_DATA = devices;
        return devices;
    };

    window.DEVICES_DATA = [];
    window.DEVICES_DATA_PROMISE = loadDevices().catch((error) => {
        console.warn('Không thể tải danh sách thiết bị từ API', error);
        window.DEVICES_DATA = [];
        return [];
    });
})();

