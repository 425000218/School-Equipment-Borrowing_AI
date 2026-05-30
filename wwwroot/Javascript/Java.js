document.addEventListener("DOMContentLoaded", () => {
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
            element.classList.add("reveal-on-scroll");
            observer.observe(element);
        });
    }

    initScrollReveal();

    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");
    
    const authModal = document.getElementById("authModal");
    const closeModalBtn = document.getElementById("closeModalBtn");
    
    const loginFormContainer = document.getElementById("loginFormContainer");
    const registerFormContainer = document.getElementById("registerFormContainer");
    
    const switchToRegister = document.getElementById("switchToRegister");
    const switchToLogin = document.getElementById("switchToLogin");

    function openModal(type) {
        authModal.style.display = "flex";
        if (type === "login") {
            loginFormContainer.style.display = "block";
            registerFormContainer.style.display = "none";
        } else {
            loginFormContainer.style.display = "none";
            registerFormContainer.style.display = "block";
        }
    }

    function closeModal() {
        authModal.style.display = "none";
    }

    if (loginBtn) {
        loginBtn.addEventListener("click", () => openModal("login"));
    }

    if (registerBtn) {
        registerBtn.addEventListener("click", () => openModal("register"));
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeModal);
    }

    // click outside to close
    window.addEventListener("click", (e) => {
        if (e.target === authModal) {
            closeModal();
        }
    });

    if (switchToRegister) {
        switchToRegister.addEventListener("click", (e) => {
            e.preventDefault();
            openModal("register");
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            openModal("login");
        });
    }
    // --- HAMBURGER MENU LOGIC ---
    // --- HAMBURGER MENU LOGIC ---
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const navLinks = document.getElementById("navLinks");

    if (hamburgerBtn && navLinks) {
        hamburgerBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prettify click bubbling issues
            hamburgerBtn.classList.toggle("open");
            navLinks.classList.toggle("open");
            
            // Cập nhật thuộc tính aria để hỗ trợ tiếp cận (accessibility)
            const isOpen = hamburgerBtn.classList.contains("open");
            hamburgerBtn.setAttribute("aria-expanded", isOpen);
        });

        // Đóng menu khi click vào một link (hữu ích cho Mobile)
        const links = navLinks.querySelectorAll(".nav-tab");
        links.forEach(link => {
            link.addEventListener("click", () => {
                hamburgerBtn.classList.remove("open");
                navLinks.classList.remove("open");
                hamburgerBtn.setAttribute("aria-expanded", "false");
            });
        });

        // Đóng menu khi click ra ngoài
        document.addEventListener("click", (e) => {
            if (!hamburgerBtn.contains(e.target) && !navLinks.contains(e.target)) {
                hamburgerBtn.classList.remove("open");
                navLinks.classList.remove("open");
                hamburgerBtn.setAttribute("aria-expanded", "false");
            }
        });
    }
});
