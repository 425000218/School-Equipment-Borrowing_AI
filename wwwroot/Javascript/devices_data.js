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
        "id": "HC001",
        "name": "Axít Sunfuric (H2SO4)",
        "category": "Hóa chất",
        "subject": "Hóa học",
        "status": "available",
        "image": "<img src=\"../Images/devices/HC001.jpg\" alt=\"Axít Sunfuric (H2SO4)\" style=\"width: 100%; height: 100%; object-fit: cover; display: block;\" />"
    },
    {
        "id": "HC002",
        "name": "Natri Hydroxit (NaOH)",
        "category": "Hóa chất",
        "subject": "Hóa học",
        "status": "unavailable",
        "image": "<img src=\"../Images/devices/HC002.jpg\" alt=\"Natri Hydroxit (NaOH)\" style=\"width: 100%; height: 100%; object-fit: cover; display: block;\" />"
    },
    {
        "id": "HC003",
        "name": "Cồn 90 độ",
        "category": "Hóa chất",
        "subject": "Hóa học",
        "status": "available",
        "image": "<img src=\"../Images/devices/HC003.jpg\" alt=\"Cồn 90 độ\" style=\"width: 100%; height: 100%; object-fit: cover; display: block;\" />"
    },
    {
        "id": "HC004",
        "name": "Muối đồng CuSO4",
        "category": "Hóa chất",
        "subject": "Hóa học",
        "status": "available",
        "image": "<img src=\"../Images/devices/HC004.jpg\" alt=\"Muối đồng CuSO4\" style=\"width: 100%; height: 100%; object-fit: cover; display: block;\" />"
    },
    {
        "id": "HC005",
        "name": "Nước cất",
        "category": "Hóa chất",
        "subject": "Hóa học",
        "status": "available",
        "image": "<img src=\"../Images/devices/HC005.jpg\" alt=\"Nước cất\" style=\"width: 100%; height: 100%; object-fit: cover; display: block;\" />"
    },
    {
        "id": "ETC01",
        "name": "Máy in Canon",
        "category": "Khác",
        "subject": "Chung",
        "status": "available",
        "image": "<img src=\"../Images/devices/ETC01.jpg\" alt=\"Máy in Canon\" style=\"width: 100%; height: 100%; object-fit: cover; display: block;\" />"
    },
    {
        "id": "ETC02",
        "name": "Giấy A4 (thùng)",
        "category": "Khác",
        "subject": "Chung",
        "status": "available",
        "image": "<img src=\"../Images/devices/ETC02.jpg\" alt=\"Giấy A4 (thùng)\" style=\"width: 100%; height: 100%; object-fit: cover; display: block;\" />"
    }
];

