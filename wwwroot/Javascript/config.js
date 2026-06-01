// ============================================================================
// FILE: config.js
// Mục đích: Tự động nhận diện môi trường (local hay production)
// và set URL gốc của API một cách thông minh
// ============================================================================

// Tự động chuyển đổi link API tùy theo môi trường đang chạy
// - Nếu chạy trên localhost/127.0.0.1 (Live Server): Gọi Railway API
// - Nếu deploy lên Railway: Dùng đường dẫn tương đối (mặc định)
window.API_BASE_URL = (function() {
    const hostname = window.location.hostname;
    
    // Danh sách hostname cảm nhận môi trường local development
    const isLocalHost = hostname === '127.0.0.1' 
                     || hostname === 'localhost'
                     || hostname.startsWith('192.168.')
                     || hostname.startsWith('10.');
    
    // Nếu chạy local: Trỏ vào Railway API (production)
    // Nếu deploy lên Railway: Để trống để dùng đường dẫn tương đối
    return isLocalHost 
        ? 'https://pure-generosity-production.up.railway.app'
        : '';
})();

// ============================================================================
// CHÚ THÍCH TIẾNG VIỆT
// ============================================================================
/**
 * Biến `API_BASE_URL` được tự động thiết lập dựa trên môi trường hiện tại:
 * 
 * 📍 Khi chạy trên LOCAL (Live Server):
 *    - window.location.hostname = "127.0.0.1"
 *    - API_BASE_URL = "https://pure-generosity-production.up.railway.app"
 *    - Cách gọi API: fetch(API_BASE_URL + '/api/auth/login')
 *    - Kết quả: Gọi lên "https://pure-generosity-production.up.railway.app/api/auth/login"
 * 
 * 🚀 Khi deploy lên RAILWAY (Production):
 *    - window.location.hostname = "pure-generosity-production.up.railway.app"
 *    - API_BASE_URL = "" (chuỗi rỗng)
 *    - Cách gọi API: fetch(API_BASE_URL + '/api/auth/login')
 *    - Kết quả: Gọi lên "/api/auth/login" (đường dẫn tương đối)
 *    - Trình duyệt tự động hiểu là: "https://pure-generosity-production.up.railway.app/api/auth/login"
 * 
 * ✅ Lợi ích:
 * - Không cần sửa code khi chuyển từ local sang production
 * - Không cần quản lý nhiều biến môi trường phức tạp
 * - Tự động phát hiện và điều chỉnh
 */
