-- db/015_sp_RoomBookings.sql
-- Định nghĩa các Stored Procedure quản lý luồng đăng ký phòng học
-- Chạy trên SQL Server (SmarterASP) sau khi đã tạo bảng dbo.room_bookings

SET NOCOUNT ON;
GO

-- 1. SP lấy danh sách đặt phòng trong khoảng ngày
CREATE OR ALTER PROCEDURE dbo.sp_RoomBookings_List
    @RoomCode NVARCHAR(50),
    @StartDate DATE,
    @EndDate DATE
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
    INNER JOIN dbo.users AS u ON b.requester_username = u.username
    INNER JOIN dbo.rooms AS r ON b.room_code = r.code
    WHERE b.room_code = @RoomCode
      AND b.booking_date >= @StartDate
      AND b.booking_date <= @EndDate
      AND b.status IN (N'pending', N'approved') -- Chỉ lấy các lịch đang chờ hoặc đã duyệt
    ORDER BY b.booking_date ASC, b.slot ASC;
END
GO

-- 2. SP tạo mới yêu cầu đăng ký phòng học (có Transaction chống trùng lặp)
CREATE OR ALTER PROCEDURE dbo.sp_RoomBookings_Create
    @RequesterUsername NVARCHAR(50),
    @RoomCode NVARCHAR(50),
    @BookingDate DATE,
    @Slot NVARCHAR(20),
    @Purpose NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- Kiểm tra phòng học tồn tại
    IF NOT EXISTS (SELECT 1 FROM dbo.rooms WHERE code = @RoomCode)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50000, N'Phòng học không tồn tại trên hệ thống.', 1;
        RETURN;
    END

    -- Kiểm tra người dùng tồn tại
    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE username = @RequesterUsername)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50000, N'Người dùng không tồn tại trên hệ thống.', 1;
        RETURN;
    END

    -- Kiểm tra trùng lịch đặt
    IF EXISTS (
        SELECT 1 
        FROM dbo.room_bookings 
        WHERE room_code = @RoomCode 
          AND booking_date = @BookingDate 
          AND slot = @Slot 
          AND status IN (N'approved', N'pending')
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50000, N'Tiết học này đã được đăng ký hoặc đang chờ duyệt bởi giáo viên khác.', 1;
        RETURN;
    END

    -- Sinh mã booking_no ngẫu nhiên
    DECLARE @TodayStr NVARCHAR(8) = CONVERT(NVARCHAR(8), GETDATE(), 112);
    DECLARE @RandomSuffix NVARCHAR(5) = SUBSTRING(REPLACE(CAST(NEWID() AS NVARCHAR(36)), N'-', N''), 1, 5);
    DECLARE @BookingNo NVARCHAR(30) = N'BK-' + @TodayStr + N'-' + UPPER(@RandomSuffix);

    -- Chèn dòng mới
    INSERT INTO dbo.room_bookings (
        booking_no,
        requester_username,
        room_code,
        booking_date,
        slot,
        purpose,
        status,
        created_at,
        updated_at
    )
    VALUES (
        @BookingNo,
        @RequesterUsername,
        @RoomCode,
        @BookingDate,
        @Slot,
        @Purpose,
        N'pending',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );

    COMMIT TRANSACTION;

    -- Trả về thông tin dòng vừa tạo
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
    INNER JOIN dbo.users AS u ON b.requester_username = u.username
    INNER JOIN dbo.rooms AS r ON b.room_code = r.code
    WHERE b.booking_no = @BookingNo;
END
GO

-- 3. SP Duyệt / Từ chối / Hủy yêu cầu đặt phòng
CREATE OR ALTER PROCEDURE dbo.sp_RoomBookings_ApplyAction
    @BookingNo NVARCHAR(30),
    @Action NVARCHAR(20), -- approve, reject, cancel
    @ActorUsername NVARCHAR(50),
    @Note NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DECLARE @BookingId INT;
    DECLARE @CurrentStatus NVARCHAR(20);

    SELECT 
        @BookingId = id,
        @CurrentStatus = status
    FROM dbo.room_bookings
    WHERE booking_no = @BookingNo;

    IF @BookingId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50000, N'Yêu cầu đăng ký phòng không tồn tại.', 1;
        RETURN;
    END

    DECLARE @NewStatus NVARCHAR(20);

    IF @Action = N'approve'
    BEGIN
        IF @CurrentStatus <> N'pending'
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50000, N'Chỉ có thể duyệt phiếu ở trạng thái chờ duyệt (pending).', 1;
            RETURN;
        END
        SET @NewStatus = N'approved';
    END
    ELSE IF @Action = N'reject'
    BEGIN
        IF @CurrentStatus <> N'pending'
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50000, N'Chỉ có thể từ chối phiếu ở trạng thái chờ duyệt (pending).', 1;
            RETURN;
        END
        SET @NewStatus = N'rejected';
    END
    ELSE IF @Action = N'cancel'
    BEGIN
        IF @CurrentStatus NOT IN (N'pending', N'approved')
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50000, N'Chỉ có thể hủy lịch đặt phòng đang chờ duyệt hoặc đã duyệt.', 1;
            RETURN;
        END
        SET @NewStatus = N'cancelled';
    END
    ELSE
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50000, N'Hành động không hợp lệ.', 1;
        RETURN;
    END

    -- Cập nhật
    UPDATE dbo.room_bookings
    SET 
        status = @NewStatus,
        handled_by = @ActorUsername,
        handled_note = @Note,
        updated_at = SYSUTCDATETIME()
    WHERE id = @BookingId;

    COMMIT TRANSACTION;

    -- Trả về dữ liệu cập nhật
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
        b.handled_by AS handledBy,
        b.handled_note AS handledNote,
        b.created_at AS createdAt,
        b.updated_at AS updatedAt
    FROM dbo.room_bookings AS b
    INNER JOIN dbo.users AS u ON b.requester_username = u.username
    INNER JOIN dbo.rooms AS r ON b.room_code = r.code
    WHERE b.id = @BookingId;
END
GO
