-- Bước 4: seed dữ liệu lookup tối thiểu (khớp UI hiện tại)
-- Chạy sau khi đã chạy: db/002_tables_lookups.sql

SET NOCOUNT ON;
GO

-- Categories (danh mục)
MERGE dbo.categories AS tgt
USING (VALUES
    (N'CNTT',               N'CNTT',               10),
    (N'Âm thanh',           N'Âm thanh',           20),
    (N'Trình chiếu',        N'Trình chiếu',        30),
    (N'Phòng lab',          N'Phòng lab',          40),
    (N'Dụng cụ thực hành',  N'Dụng cụ thực hành',  50),
    (N'Hóa chất',           N'Hóa chất',           60),
    (N'Khác',               N'Khác',               70)
) AS src(code, name, sort_order)
ON tgt.code = src.code
WHEN MATCHED THEN
    UPDATE SET
        tgt.name = src.name,
        tgt.sort_order = src.sort_order,
        tgt.is_active = 1
WHEN NOT MATCHED THEN
    INSERT (code, name, sort_order, is_active)
    VALUES (src.code, src.name, src.sort_order, 1);
GO

-- Subjects (môn học)
MERGE dbo.subjects AS tgt
USING (VALUES
    (N'Vật lý',   N'Vật lý',             10),
    (N'Hóa học',  N'Hóa học',            20),
    (N'Sinh học', N'Sinh học',           30),
    (N'Tin học',  N'Tin học',            40),
    (N'Chung',    N'Khác / Dùng chung',  50)
) AS src(code, name, sort_order)
ON tgt.code = src.code
WHEN MATCHED THEN
    UPDATE SET
        tgt.name = src.name,
        tgt.sort_order = src.sort_order,
        tgt.is_active = 1
WHEN NOT MATCHED THEN
    INSERT (code, name, sort_order, is_active)
    VALUES (src.code, src.name, src.sort_order, 1);
GO

-- Room types (loại phòng)
MERGE dbo.room_types AS tgt
USING (VALUES
    (N'cntt', N'Phòng CNTT',   10),
    (N'ly',   N'Phòng Vật lý', 20)
) AS src(code, name, sort_order)
ON tgt.code = src.code
WHEN MATCHED THEN
    UPDATE SET
        tgt.name = src.name,
        tgt.sort_order = src.sort_order,
        tgt.is_active = 1
WHEN NOT MATCHED THEN
    INSERT (code, name, sort_order, is_active)
    VALUES (src.code, src.name, src.sort_order, 1);
GO

-- Rooms (số phòng)
MERGE dbo.rooms AS tgt
USING (VALUES
    (CAST(NULL AS INT), N'101', N'101', 10),
    (CAST(NULL AS INT), N'102', N'102', 20)
) AS src(room_type_id, code, name, sort_order)
ON tgt.code = src.code
WHEN MATCHED THEN
    UPDATE SET
        tgt.name = src.name,
        tgt.sort_order = src.sort_order,
        tgt.is_active = 1
WHEN NOT MATCHED THEN
    INSERT (room_type_id, code, name, sort_order, is_active)
    VALUES (src.room_type_id, src.code, src.name, src.sort_order, 1);
GO

-- Users (người sử dụng cho dropdown)
MERGE dbo.users AS tgt
USING (VALUES
    (N'gv-a', N'GV. Nguyễn Văn A'),
    (N'gv-b', N'GV. Trần Thị B')
) AS src(username, full_name)
ON tgt.username = src.username
WHEN MATCHED THEN
    UPDATE SET
        tgt.full_name = src.full_name,
        tgt.status = N'active'
WHEN NOT MATCHED THEN
    INSERT (username, full_name, status)
    VALUES (src.username, src.full_name, N'active');
GO
