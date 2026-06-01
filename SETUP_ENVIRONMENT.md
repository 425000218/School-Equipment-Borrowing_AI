# 🛠️ Hướng dẫn thiết lập môi trường Development - API Tự động nhận diện

## 📋 Tóm tắt các thay đổi thực hiện

### 1️⃣ File mới tạo: `config.js`
- **Đường dẫn**: `wwwroot/Javascript/config.js`
- **Mục đích**: Tự động nhận diện môi trường (Local hay Production)
- **Tính năng chính**:
  - Khi chạy trên **localhost/127.0.0.1**: Trỏ URL API tới Railway (`https://pure-generosity-production.up.railway.app`)
  - Khi deploy trên **Railway**: Để trống (`''`) để dùng đường dẫn tương đối

### 2️⃣ Cập nhật file HTML
Tất cả file HTML đều được cập nhật để load `config.js` **ĐẦU TIÊN** trước các file JavaScript khác:

**Các file được cập nhật:**
- ✅ `index.html`
- ✅ `Page/kho-ca-nhan.html`
- ✅ `Page/admin.html`
- ✅ `Page/dang-nhap.html`
- ✅ `Page/kho_thiet_bi.html`
- ✅ `Page/dang-ky-phong-hoc.html`
- ✅ `Page/news.html`
- ✅ `Page/about.html`
- ✅ `Page/ve-chung-toi.html`
- ✅ `Page/ve-du-an.html`

### 3️⃣ File JavaScript đã hỗ trợ API_BASE_URL
Các file này **đã sẵn sàng** sử dụng biến `window.API_BASE_URL`:
- ✅ `auth.js` - Xử lý đăng nhập/logout
- ✅ `user_dashboard.js` - Load danh sách mượn/đặt phòng
- ✅ `admin.js` - Quản lý người dùng, yêu cầu mượn
- ✅ `kho_thiet_bi.js` - Load danh sách thiết bị
- ✅ `dang-ky-phong.js` - Load danh sách phòng học
- ✅ `router.js` - Định tuyến PJAX

---

## 🚀 Cách sử dụng

### Khi chạy trên Local (Live Server)

```bash
# 1. Mở project bằng Live Server
# URL sẽ là: http://127.0.0.1:5500

# 2. Tự động xảy ra:
# - config.js phát hiện hostname = "127.0.0.1"
# - Thiết lập: window.API_BASE_URL = "https://pure-generosity-production.up.railway.app"
# - Tất cả fetch call sẽ gọi tới Railway API

# 3. Bạn sẽ thấy:
✅ Giao diện load được đầy đủ dữ liệu
✅ Đăng nhập hoạt động
✅ Danh sách thiết bị/phòng load bình thường
```

### Khi deploy lên Railway (Production)

```bash
# 1. Push code lên GitHub
# 2. Railway tự động deploy từ GitHub

# 3. Tự động xảy ra:
# - config.js phát hiện hostname = "pure-generosity-production.up.railway.app"
# - Thiết lập: window.API_BASE_URL = "" (chuỗi rỗng)
# - Tất cả fetch call sẽ dùng đường dẫn tương đối (/api/...)
# - Trình duyệt hiểu là gọi tới Railway backend của chính nó

# 4. Kết quả:
✅ Không cần sửa code
✅ API call tự động trỏ chính xác
✅ Ứng dụng chạy mượt mà
```

---

## 🔍 Cách kiểm chứng hoạt động

### Bước 1: Mở Live Server
```
1. Click chuột phải vào index.html
2. Chọn "Open with Live Server"
3. Trình duyệt mở tại http://127.0.0.1:5500
```

### Bước 2: Kiểm tra Config
```javascript
// Mở Console (F12)
// Gõ lệnh:
console.log('API Base URL:', window.API_BASE_URL);

// Kết quả dự kiến:
// API Base URL: https://pure-generosity-production.up.railway.app
```

### Bước 3: Kiểm tra Network
```
1. Mở DevTools (F12) → Network tab
2. Thực hiện một hành động (đăng nhập, load danh sách)
3. Xem request:
   - URL sẽ hiển thị: https://pure-generosity-production.up.railway.app/api/...
   - Status: 200 (thành công) hoặc 401 (auth issue)
```

---

## ⚙️ Tùy chỉnh URL Railway

Nếu URL Railway của bạn thay đổi, hãy cập nhật file:

**`wwwroot/Javascript/config.js` (dòng ~15)**
```javascript
// Thay thế URL này:
return isLocalHost 
    ? 'https://pure-generosity-production.up.railway.app'  // ← Sửa ở đây
    : '';
```

---

## 📌 Lợi ích của giải pháp

| Tình huống | Trước | Sau |
|-----------|-------|-----|
| **Chạy Live Server Local** | ❌ Lỗi 404 (không gọi được API) | ✅ Gọi Railway API bình thường |
| **Deploy Production** | ⚠️ Cần sửa code thủ công | ✅ Tự động dùng đường dẫn tương đối |
| **Quản lý cấu hình** | 😞 Phức tạp, dễ nhầm lẫn | 😊 Tự động, không cần sửa |

---

## 🐛 Troubleshooting

### Vấn đề: Giao diện trắng, không load dữ liệu

**Kiểm tra:**
```javascript
// Mở Console (F12)
console.log('API_BASE_URL:', window.API_BASE_URL);
console.log('hostname:', window.location.hostname);
```

**Nguyên nhân có thể:**
1. ❌ `API_BASE_URL` là `undefined` → config.js chưa load
   - **Fix**: Kiểm tra file HTML có load config.js TRƯỚC auth.js không

2. ❌ URL Railway sai → 404 error
   - **Fix**: Cập nhật URL trong config.js

3. ❌ Railway API down
   - **Fix**: Kiểm tra trạng thái Railway dashboard

### Vấn đề: Network request bị CORS error

**Nguyên nhân:** Backend Railway không cho phép request từ localhost

**Fix:** Cập nhật CORS policy trong Backend (nếu cần)

---

## 📚 Tài liệu liên quan

- [Railway Documentation](https://docs.railway.app)
- [Fetch API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [CORS Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

## ✅ Checklist

- [x] Tạo file `config.js` với logic tự động nhận diện
- [x] Cập nhật tất cả file HTML để load config.js trước
- [x] Xác minh tất cả file JavaScript đã sử dụng `window.API_BASE_URL`
- [x] Tài liệu hóa cách sử dụng và troubleshooting

---

**Được tạo**: June 1, 2026 | **Cập nhật lần cuối**: June 1, 2026
