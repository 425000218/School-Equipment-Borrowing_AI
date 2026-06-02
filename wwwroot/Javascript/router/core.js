// router/core.js
// Core PJAX navigation logic (loadPage, executeScripts, etc.)

export function executeScripts(container) {
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
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

let activeAbortController = null;
let configLoaded = false;

export async function loadPage(url, pushState = true) {
    try {
        // Navigation logic – same as original but without cleanup and init calls
        const currentWrapper = document.querySelector('.section-wrapper');
        if (currentWrapper) {
            currentWrapper.classList.add('fade-out');
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        if (activeAbortController) {
            activeAbortController.abort();
        }
        const controller = new AbortController();
        activeAbortController = controller;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            window.location.href = url;
            return;
        }
        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const targetHead = doc.querySelector('head');
        if (targetHead) {
            const targetStylesheets = targetHead.querySelectorAll('link[rel="stylesheet"]');
            targetStylesheets.forEach(link => {
                const linkHref = link.getAttribute('href');
                if (linkHref) {
                    const resolvedHref = new URL(linkHref, new URL(url, window.location.origin)).href;
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
        // Replace main content
        const newMain = doc.querySelector('#main-content');
        const oldMain = document.querySelector('#main-content');
        if (newMain && oldMain) {
            oldMain.replaceWith(newMain.cloneNode(true));
        } else {
            const newWrapper = doc.querySelector('.section-wrapper');
            const activeWrapper = document.querySelector('.section-wrapper');
            if (newWrapper && activeWrapper) {
                // Ensure old content is fully cleared to avoid duplication
                activeWrapper.innerHTML = '';
                newWrapper.classList.add('fade-in');
                activeWrapper.parentNode.replaceChild(newWrapper, activeWrapper);
            }
        }
        // Update title
        const newTitle = doc.querySelector('title');
        if (newTitle) {
            document.title = newTitle.textContent;
        }
        if (pushState) {
            history.pushState(null, '', url);
        }
        // Update navbar active state – function imported from init.js will be used later
        // Execute scripts in the new wrapper
        const newWrapper = doc.querySelector('.section-wrapper');
        if (newWrapper) {
            executeScripts(newWrapper);
        }
        // Inject body scripts (excluding router & config which are already loaded)
        const bodyScripts = doc.querySelectorAll('body script');
        bodyScripts.forEach(oldScript => {
            if (oldScript.src && oldScript.src.includes('router.js')) return;
            if (oldScript.src && oldScript.src.includes('config.js')) return;
            const scriptSrc = oldScript.getAttribute('src');
            if (scriptSrc) {
                const existing = document.querySelector(`script[src="${scriptSrc}"]`);
                if (existing && !existing.src.includes('config.js')) existing.remove();
                const newScript = document.createElement('script');
                newScript.src = scriptSrc;
                // Preserve module type if the original script was a module
                if (oldScript.type === 'module') {
                    newScript.type = 'module';
                }
                newScript.setAttribute('data-pjax', 'true');
                document.body.appendChild(newScript);
            } else {
                const newScript = document.createElement('script');
                newScript.textContent = oldScript.textContent;
                // Preserve module type for inline scripts
                if (oldScript.type === 'module') {
                    newScript.type = 'module';
                }
                newScript.setAttribute('data-pjax', 'true');
                document.body.appendChild(newScript);
            }
        });
        // Dispatch custom event so page‑specific init can react
        window.dispatchEvent(new CustomEvent('seb:page-loaded', { detail: { url } }));
        // Scroll to top
        window.scrollTo(0, 0);
        // Sync auth UI if present
        if (window.SEBAuth && typeof window.SEBAuth.syncAuthUi === 'function') {
            window.SEBAuth.syncAuthUi();
        }
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('PJAX error, loading page standard:', error);
        window.location.href = url;
    }
}
