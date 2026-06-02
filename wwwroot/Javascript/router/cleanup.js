// router/cleanup.js
// Functions responsible for cleaning up the DOM and removing leftover UI elements before a PJAX navigation.

export function cleanupOldPage() {
    // Remove all delegated jQuery events (prevent duplicate handlers)
    if (window.jQuery) {
        $(window).off();
        $(document).off();
    }

    // Remove UI elements injected outside .section-wrapper: modals, tooltips, overlays, toasts, temp PJAX elements
    const leftovers = document.querySelectorAll('.modal, .tooltip, .overlay, .toast, .p-ajax-temp');
    leftovers.forEach(node => node.remove());

    // Remove previously injected PJAX scripts (marked with data‑pjax="true")
    document.querySelectorAll('script[data-pjax="true"]').forEach(s => s.remove());

    // Clear the main content container fully
    const mainWrapper = document.querySelector('.section-wrapper');
    if (mainWrapper) {
        mainWrapper.innerHTML = '';
        mainWrapper.classList.remove('fade-out', 'fade-in');
    }
}
