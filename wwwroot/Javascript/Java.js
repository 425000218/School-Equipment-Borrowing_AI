// Java.js
// Quản lý các hiệu ứng động chung, cuộn trang (scroll reveal) và nút menu di động (hamburger)

(function () {
    function initScrollReveal() {
        const revealTargets = document.querySelectorAll(".section-wrapper, .search-container, .stats-row, .footer");
        if (!revealTargets.length) {
            return;
        }

        if (!("IntersectionObserver" in window)) {
            revealTargets.forEach((element) => {
                element.classList.add("is-visible");
            });
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -30px 0px",
            }
        );

        revealTargets.forEach((element) => {
            // Đảm bảo không trùng lặp class hiệu ứng
            element.classList.remove("is-visible");
            element.classList.add("reveal-on-scroll");
            observer.observe(element);
        });
    }

    function initHamburger() {
        const hamburgerBtn = document.getElementById("hamburgerBtn");
        const navLinks = document.getElementById("navLinks");

        if (hamburgerBtn && navLinks && !hamburgerBtn.dataset.hasListener) {
            hamburgerBtn.dataset.hasListener = "true";
            
            hamburgerBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                hamburgerBtn.classList.toggle("open");
                navLinks.classList.toggle("open");
                
                const isOpen = hamburgerBtn.classList.contains("open");
                hamburgerBtn.setAttribute("aria-expanded", isOpen);
            });

            // Đóng menu khi click vào một link
            const links = navLinks.querySelectorAll(".nav-tab");
            links.forEach(link => {
                link.addEventListener("click", () => {
                    hamburgerBtn.classList.remove("open");
                    navLinks.classList.remove("open");
                    hamburgerBtn.setAttribute("aria-expanded", "false");
                });
            });

            // Đóng menu khi click ra ngoài (chỉ đăng ký 1 lần duy nhất trên document)
            if (!window.hasHamburgerClickOutListener) {
                window.hasHamburgerClickOutListener = true;
                document.addEventListener("click", (e) => {
                    const curHamburgerBtn = document.getElementById("hamburgerBtn");
                    const curNavLinks = document.getElementById("navLinks");
                    if (curHamburgerBtn && curNavLinks) {
                        if (!curHamburgerBtn.contains(e.target) && !curNavLinks.contains(e.target)) {
                            curHamburgerBtn.classList.remove("open");
                            curNavLinks.classList.remove("open");
                            curHamburgerBtn.setAttribute("aria-expanded", "false");
                        }
                    }
                });
            }
        }
    }

    function initAll() {
        initScrollReveal();
        initHamburger();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAll);
    } else {
        initAll();
    }

    // Lắng nghe sự kiện tải trang động từ Router
    window.addEventListener("seb:page-loaded", () => {
        initScrollReveal();
        
        // Đóng menu di động nếu đang mở
        const hamburgerBtn = document.getElementById("hamburgerBtn");
        const navLinks = document.getElementById("navLinks");
        if (hamburgerBtn && navLinks) {
            hamburgerBtn.classList.remove("open");
            navLinks.classList.remove("open");
            hamburgerBtn.setAttribute("aria-expanded", "false");
        }
    });
})();
