-- Bước 5: seed dữ liệu thiết bị tối thiểu
-- Chạy sau khi đã chạy:
--   - db/005_tables_devices.sql

SET NOCOUNT ON;
GO

MERGE dbo.devices AS tgt
USING (VALUES
    (N'IT001', N'Laptop Dell Latitude',            N'CNTT',             N'Tin học',  N'available',   7,  N'Laptop cho phòng tin học', N'IT001.jpg', 10),
    (N'IT002', N'Màn hình Dell 24 inch',           N'CNTT',             N'Tin học',  N'available',   5,  N'Màn hình phục vụ phòng máy', N'IT002.jpg', 20),
    (N'IT003', N'Router Wifi Cisco',               N'CNTT',             N'Tin học',  N'available',   3,  N'Thiết bị mạng thực hành', N'IT003.jpg', 30),
    (N'IT004', N'Bàn phím cơ Logitech',            N'CNTT',             N'Tin học',  N'unavailable', 8,  N'Bàn phím cho phòng máy', N'IT004.jpg', 40),
    (N'IT005', N'Chuột không dây',                 N'CNTT',             N'Tin học',  N'available',   12, N'Chuột không dây', N'IT005.jpg', 50),
    (N'IT006', N'Máy chủ HP ProLiant',             N'CNTT',             N'Tin học',  N'available',   1,  N'Máy chủ demo cho phòng CNTT', N'IT006.jpg', 60),
    (N'IT007', N'Cáp mạng 20m',                    N'CNTT',             N'Tin học',  N'available',   15, N'Cáp mạng dài', N'IT007.jpg', 70),
    (N'AU001', N'Loa kéo di động',                 N'Âm thanh',         N'Chung',    N'available',   2,  N'Loa kéo phục vụ sự kiện', N'AU001.jpg', 80),
    (N'AU002', N'Micro không dây',                 N'Âm thanh',         N'Chung',    N'unavailable', 4,  N'Micro phục vụ hội nghị', N'AU002.jpg', 90),
    (N'AU003', N'Amply Jarguar',                   N'Âm thanh',         N'Chung',    N'available',   2,  N'Amply khuếch đại âm thanh', N'AU003.jpg', 100),
    (N'PR001', N'Máy chiếu Panasonic',             N'Trình chiếu',      N'Chung',    N'available',   4,  N'Máy chiếu cho lớp học', N'PR001.jpg', 110),
    (N'PR002', N'Màn chiếu 120 inch',              N'Trình chiếu',      N'Chung',    N'available',   6,  N'Màn chiếu đi kèm máy chiếu', N'PR002.jpg', 120),
    (N'PR003', N'Bút laser trình chiếu',           N'Trình chiếu',      N'Chung',    N'unavailable', 10, N'Bút trình chiếu', N'PR003.jpg', 130),
    (N'LAB01', N'Kính hiển vi điện tử',            N'Phòng lab',         N'Sinh học', N'available',   2,  N'Kính hiển vi dùng trong thực hành', N'LAB01.jpg', 140),
    (N'LAB02', N'Cân phân tích 4 số lẻ',           N'Phòng lab',         N'Hóa học',  N'available',   3,  N'Cân độ chính xác cao', N'LAB02.jpg', 150),
    (N'LAB03', N'Lò sấy vi sinh',                  N'Phòng lab',         N'Sinh học', N'available',   1,  N'Lò sấy phục vụ thí nghiệm', N'LAB03.jpg', 160),
    (N'LAB04', N'Tủ cấy vô trùng',                 N'Phòng lab',         N'Sinh học', N'unavailable', 1,  N'Tủ cấy vô trùng', N'LAB04.jpg', 170),
    (N'TH001', N'Bộ dụng cụ quang học',            N'Dụng cụ thực hành', N'Vật lý',   N'available',   6,  N'Dụng cụ quang học', N'TH001.jpg', 180),
    (N'TH002', N'Bộ dụng cụ cơ học',               N'Dụng cụ thực hành', N'Vật lý',   N'available',   5,  N'Dụng cụ cơ học', N'TH002.jpg', 190),
    (N'TH003', N'Mô hình giải phẫu',               N'Dụng cụ thực hành', N'Sinh học', N'unavailable', 2,  N'Mô hình giải phẫu', N'TH003.jpg', 200),
    (N'TH004', N'Đồng hồ đa năng (VOM)',           N'Dụng cụ thực hành', N'Vật lý',   N'available',   9,  N'Đồng hồ đo đa năng', N'TH004.jpg', 210)
) AS src(code, name, category_code, subject_code, status, quantity, description, image_file, sort_order)
ON tgt.code = src.code
WHEN MATCHED THEN
    UPDATE SET
        tgt.name = src.name,
        tgt.category_code = src.category_code,
        tgt.subject_code = src.subject_code,
        tgt.status = src.status,
        tgt.quantity = src.quantity,
        tgt.description = src.description,
        tgt.image_file = src.image_file,
        tgt.sort_order = src.sort_order,
        tgt.is_active = 1
WHEN NOT MATCHED THEN
    INSERT (code, name, category_code, subject_code, status, quantity, description, image_file, sort_order, is_active)
    VALUES (src.code, src.name, src.category_code, src.subject_code, src.status, src.quantity, src.description, src.image_file, src.sort_order, 1);
GO