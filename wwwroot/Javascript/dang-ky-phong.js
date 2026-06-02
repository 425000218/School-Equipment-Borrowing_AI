// wwwroot/Javascript/dang-ky-phong.js
// Thin wrapper that imports the modular booking logic.

import { initBookingPage } from './booking/init.js';

// Expose globally for router's page‑init registry.
window.initBookingPage = initBookingPage;

// Direct page load handling.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingPage);
} else {
    initBookingPage();
}
// Respond to PJAX navigation events.
window.addEventListener('seb:page-loaded', initBookingPage);
