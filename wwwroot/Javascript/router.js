// router.js (module entry point)
// This file wires together the PJAX router sub‑modules.

import { loadPage as coreLoadPage } from './router/core.js';
import { cleanupOldPage } from './router/cleanup.js';
import { updateNavActiveState, registerNavHandlers, runPageInit } from './router/init.js';

// Wrap core loadPage to include cleanup and init steps
export async function loadPage(url, pushState = true) {
    // Clean up previous page state
    cleanupOldPage();
    // Load the new page content via core logic
    await coreLoadPage(url, pushState);
    // After navigation, run page‑specific init (e.g., booking page)
    runPageInit(url);
}

// Expose globally for other modules (e.g., init.js navigation handlers)
window.SEBRouter = { loadPage };

// Register navigation event listeners once the script loads
registerNavHandlers();
