-- 018_sp_User_MyRequests.sql
-- Chạy trên SQL Server sau khi đã có các bảng

SET NOCOUNT ON;
GO

-- 1. Lấy danh sách phiếu mượn của User
CREATE OR ALTER PROCEDURE dbo.sp_User_MyBorrowRequests_List
    @Username NVARCHAR(50)
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
    WHERE r.requester_username = @Username
    ORDER BY r.created_at DESC;
END
GO

-- 2. Lấy danh sách đặt phòng của User
CREATE OR ALTER PROCEDURE dbo.sp_User_MyRoomBookings_List
    @Username NVARCHAR(50)
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
    WHERE b.requester_username = @Username
    ORDER BY b.created_at DESC;
END
GO

-- 3. User Thu hồi Phiếu mượn
CREATE OR ALTER PROCEDURE dbo.sp_User_CancelBorrowRequest
    @Id INT,
    @Username NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentStatus NVARCHAR(20);
    DECLARE @Requester NVARCHAR(50);
    
    SELECT @CurrentStatus = status, @Requester = requester_username 
    FROM dbo.borrow_requests WHERE id = @Id;

    IF @CurrentStatus IS NULL
    BEGIN
        THROW 50000, N'Phiếu mượn không tồn tại.', 1;
        RETURN;
    END

    IF @Requester != @Username
    BEGIN
        THROW 50000, N'Bạn không có quyền thu hồi phiếu mượn này.', 1;
        RETURN;
    END

    IF @CurrentStatus != 'pending'
    BEGIN
        THROW 50001, N'Không thể thu hồi phiếu đã được xử lý.', 1;
        RETURN;
    END

    UPDATE dbo.borrow_requests
    SET 
        status = 'cancelled',
        updated_at = SYSUTCDATETIME()
    WHERE id = @Id;
END
GO

-- 4. User Thu hồi Lịch phòng
CREATE OR ALTER PROCEDURE dbo.sp_User_CancelRoomBooking
    @Id INT,
    @Username NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentStatus NVARCHAR(20);
    DECLARE @Requester NVARCHAR(50);
    
    SELECT @CurrentStatus = status, @Requester = requester_username 
    FROM dbo.room_bookings WHERE id = @Id;

    IF @CurrentStatus IS NULL
    BEGIN
        THROW 50000, N'Lịch phòng không tồn tại.', 1;
        RETURN;
    END

    IF @Requester != @Username
    BEGIN
        THROW 50000, N'Bạn không có quyền thu hồi lịch phòng này.', 1;
        RETURN;
    END

    IF @CurrentStatus != 'pending'
    BEGIN
        THROW 50001, N'Không thể thu hồi lịch phòng đã được xử lý.', 1;
        RETURN;
    END

    UPDATE dbo.room_bookings
    SET 
        status = 'cancelled',
        updated_at = SYSUTCDATETIME()
    WHERE id = @Id;
END
GO
