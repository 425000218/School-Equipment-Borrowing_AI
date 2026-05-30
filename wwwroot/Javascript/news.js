// ============================================
//  news.js — Logic trang tin tức
// ============================================

// ---- Category Filter ----
const filterBtns = document.querySelectorAll('.news-filter-btn');
const newsCards  = document.querySelectorAll('.news-card');
const newsEmpty  = document.getElementById('newsEmpty');

filterBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    // Cập nhật nút active
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.getAttribute('data-filter');
    let visibleCount = 0;

    newsCards.forEach(function (card, index) {
      const category = card.getAttribute('data-category');
      const match    = filter === 'all' || category === filter;

      if (match) {
        card.style.display = '';
        // Staggered animation
        card.style.animationDelay = (visibleCount * 0.06) + 's';
        card.style.animation = 'none';
        // Force reflow để restart animation
        void card.offsetWidth;
        card.style.animation = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Ẩn/hiện empty state
    if (newsEmpty) {
      newsEmpty.style.display = visibleCount === 0 ? 'flex' : 'none';
    }
  });
});

// ---- Load More (giả lập) ----
const loadMoreBtn = document.getElementById('loadMoreBtn');
let   extraLoaded = false;

if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', function () {
    if (extraLoaded) return;

    // Bài viết bổ sung khi nhấn "Xem thêm"
    const extraArticles = [
      {
        category: 'thong-bao',
        badgeClass: 'badge-thong-bao',
        badgeIcon: 'fas fa-bullhorn',
        badgeLabel: 'Thông báo',
        gradient: 'gradient-thong-bao',
        icon: 'fas fa-file-alt',
        title: 'Cập nhật phần mềm quản lý kho — Phiên bản 2.1',
        excerpt: 'Hệ thống SEB vừa cập nhật phiên bản 2.1 với nhiều cải tiến về tốc độ tra cứu thiết bị và giao diện quản lý kho.',
        date: '12/01/2026',
        time: '3 phút'
      },
      {
        category: 'bao-tri',
        badgeClass: 'badge-bao-tri',
        badgeIcon: 'fas fa-tools',
        badgeLabel: 'Bảo trì',
        gradient: 'gradient-bao-tri',
        icon: 'fas fa-wrench',
        title: 'Lịch bảo trì định kỳ Quý 1/2026 toàn trường',
        excerpt: 'Phòng Thiết bị thông báo lịch bảo trì định kỳ tất cả thiết bị trong Quý 1/2026, bắt đầu từ ngày 15/01/2026.',
        date: '13/01/2026',
        time: '2 phút'
      },
      {
        category: 'su-kien',
        badgeClass: 'badge-su-kien',
        badgeIcon: 'fas fa-calendar-alt',
        badgeLabel: 'Sự kiện',
        gradient: 'gradient-su-kien',
        icon: 'fas fa-star',
        title: 'Trường Lộc An đạt giải Nhất cuộc thi Đổi mới sáng tạo',
        excerpt: 'Hệ thống SEB mang lại thành tích xuất sắc khi nhận giải Nhất cuộc thi Đổi mới sáng tạo trong quản lý trường học cấp tỉnh.',
        date: '20/01/2026',
        time: '4 phút'
      }
    ];

    const grid = document.getElementById('newsGrid');
    if (!grid) return;

    extraArticles.forEach(function (a, i) {
      const article = document.createElement('article');
      article.className = 'news-card';
      article.setAttribute('data-category', a.category);
      article.style.animationDelay = (i * 0.08) + 's';
      article.innerHTML = `
        <div class="news-card-img ${a.gradient}">
          <i class="${a.icon}"></i>
        </div>
        <div class="news-card-body">
          <span class="news-badge ${a.badgeClass}">
            <i class="${a.badgeIcon}"></i> ${a.badgeLabel}
          </span>
          <h3 class="news-card-title">${a.title}</h3>
          <p class="news-card-excerpt">${a.excerpt}</p>
          <div class="news-card-meta">
            <span><i class="far fa-calendar"></i> ${a.date}</span>
            <span><i class="far fa-clock"></i> ${a.time}</span>
          </div>
        </div>
        <div class="news-card-footer">
          <button class="news-card-btn">Đọc thêm <i class="fas fa-chevron-right"></i></button>
        </div>
      `;
      grid.appendChild(article);
    });

    extraLoaded = true;

    // Đổi nút thành "Đã tải hết"
    loadMoreBtn.innerHTML = '<i class="fas fa-check"></i> Đã tải tất cả bài viết';
    loadMoreBtn.disabled  = true;
    loadMoreBtn.style.opacity  = '0.6';
    loadMoreBtn.style.cursor   = 'default';
    loadMoreBtn.style.transform = 'none';
  });
}
