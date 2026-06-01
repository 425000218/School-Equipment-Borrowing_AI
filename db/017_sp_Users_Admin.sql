-- db/017_sp_Users_Admin.sql
-- Cập nhật SP cho Đăng ký, Cập nhật Profile, Admin Users và Admin Tracking

SET NOCOUNT ON;
GO

-- 1. Đăng ký tài khoản (Người dùng tự đăng ký, mặc định status = pending)
CREATE OR ALTER PROCEDURE dbo.sp_Users_Register
    @Username NVARCHAR(50),
    @PasswordHash NVARCHAR(255),
    @FullName NVARCHAR(150),
    @Email NVARCHAR(255),
    @Phone NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.users WHERE username = @Username)
    BEGIN
        THROW 50000, N'Tên đăng nhập đã tồn tại trên hệ thống.', 1;
        RETURN;
    END

    INSERT INTO dbo.users (username, password_hash, full_name, email, phone, role, status)
    VALUES (@Username, @PasswordHash, @FullName, @Email, @Phone, N'user', N'pending');

    SELECT id, username, full_name AS fullName, role, status
    FROM dbo.users
    WHERE username = @Username;
END
GO

-- 2. User tự cập nhật Profile cá nhân
CREATE OR ALTER PROCEDURE dbo.sp_Users_UpdateProfile
    @Username NVARCHAR(50),
    @FullName NVARCHAR(150),
    @Email NVARCHAR(255),
    @Phone NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE username = @Username)
    BEGIN
        THROW 50000, N'Tài khoản không tồn tại.', 1;
        RETURN;
    END

    UPDATE dbo.users
    SET 
        full_name = @FullName,
        email = @Email,
        phone = @Phone
    WHERE username = @Username;

    SELECT username, full_name AS fullName, email, phone, role, status
    FROM dbo.users
    WHERE username = @Username;
END
GO

-- 3. Admin: Lấy danh sách toàn bộ User
CREATE OR ALTER PROCEDURE dbo.sp_Admin_Users_List
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        id,
        username,
        email,
        full_name AS fullName,
        phone,
        role,
        status,
        created_at AS createdAt
    FROM dbo.users
    ORDER BY created_at DESC;
END
GO

-- 4. Admin: Sửa thông tin User (bao gồm đổi status, role)
CREATE OR ALTER PROCEDURE dbo.sp_Admin_Users_Update
    @Username NVARCHAR(50),
    @FullName NVARCHAR(150),
    @Email NVARCHAR(255),
    @Phone NVARCHAR(30),
    @Role NVARCHAR(20),
    @Status NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE username = @Username)
    BEGIN
        THROW 50000, N'Tài khoản không tồn tại.', 1;
        RETURN;
    END

    UPDATE dbo.users
    SET 
        full_name = @FullName,
        email = @Email,
        phone = @Phone,
        role = @Role,
        status = @Status
    WHERE username = @Username;

    SELECT username, full_name AS fullName, email, phone, role, status
    FROM dbo.users
    WHERE username = @Username;
END
GO

-- 5. Admin: Xóa User
CREATE OR ALTER PROCEDURE dbo.sp_Admin_Users_Delete
    @Username NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE username = @Username)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50000, N'Tài khoản không tồn tại.', 1;
        RETURN;
    END

    -- Xóa các liên kết (Yêu cầu phải ON DELETE CASCADE hoặc phải tự xóa thủ công)
    DELETE FROM dbo.personal_devices WHERE username = @Username;
    -- Note: room_bookings và borrow_requests không có ON DELETE CASCADE cho users.
    -- Nếu user có lịch sử, chuyển status sang 'deleted' thay vì xóa vật lý để giữ lịch sử.
    
    DECLARE @CanHardDelete BIT = 1;
    IF EXISTS (SELECT 1 FROM dbo.borrow_requests WHERE requester_username = @Username)
       OR EXISTS (SELECT 1 FROM dbo.room_bookings WHERE requester_username = @Username)
    BEGIN
        SET @CanHardDelete = 0;
    END

    IF @CanHardDelete = 1
    BEGIN
        DELETE FROM dbo.users WHERE username = @Username;
    END
    ELSE
    BEGIN
        -- Soft delete
        UPDATE dbo.users SET status = N'deleted' WHERE username = @Username;
    END

    COMMIT TRANSACTION;

    SELECT @Username AS username, @CanHardDelete AS hardDeleted;
END
GO

-- 6. Admin: Lấy tất cả lịch sử mượn trả
CREATE OR ALTER PROCEDURE dbo.sp_Admin_BorrowRequests_List
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        r.id,
        r.request_no AS requestNo,
        r.requester_username AS requesterUsername,
        u.full_name AS requesterFullName,
        ISNULL(i.device_code, '') AS deviceCode,
        d.name AS deviceName,
        d.image_file AS deviceImageUrl,
        ISNULL(i.quantity, 1) AS quantity,
        r.status,
        r.created_at AS createdAt
    FROM dbo.borrow_requests AS r
    LEFT JOIN dbo.borrow_request_items AS i ON r.id = i.borrow_request_id
    LEFT JOIN dbo.devices AS d ON i.device_code = d.code
    LEFT JOIN dbo.users AS u ON r.requester_username = u.username
    ORDER BY r.created_at DESC;
END
GO

-- 7. Admin: Lấy tất cả lịch sử đặt phòng
CREATE OR ALTER PROCEDURE dbo.sp_Admin_RoomBookings_List
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        b.id,
        b.booking_no AS bookingNo,
        b.requester_username AS requesterUsername,
        u.full_name AS requesterFullName,
        b.room_code AS roomCode,
        r.name AS roomName,
        b.booking_date AS bookingDate,
        b.slot,
        b.purpose,
        b.status,
        b.created_at AS createdAt
    FROM dbo.room_bookings AS b
    LEFT JOIN dbo.users AS u ON b.requester_username = u.username
    LEFT JOIN dbo.rooms AS r ON b.room_code = r.code
    ORDER BY b.created_at DESC;
END
GO
