-- db/014_tables_room_bookings.sql
-- Tạo bảng dbo.room_bookings quản lý lịch đăng ký phòng học
-- Chạy trên SQL Server (SmarterASP) sau khi đã chạy các script khởi tạo danh mục

SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.room_bookings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.room_bookings
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_room_bookings PRIMARY KEY,
        booking_no NVARCHAR(30) NOT NULL CONSTRAINT UQ_room_bookings_booking_no UNIQUE,
        requester_username NVARCHAR(50) NOT NULL,
        room_code NVARCHAR(50) NOT NULL,
        booking_date DATE NOT NULL,
        slot NVARCHAR(20) NOT NULL, -- Sang_T1, Sang_T2..., Chieu_T1...
        purpose NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_room_bookings_status DEFAULT(N'pending'), -- pending, approved, rejected, cancelled
        handled_by NVARCHAR(50) NULL,
        handled_note NVARCHAR(MAX) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_room_bookings_created_at DEFAULT(SYSUTCDATETIME()),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_room_bookings_updated_at DEFAULT(SYSUTCDATETIME())
    );

    -- Khóa ngoại liên kết bảng users và rooms
    ALTER TABLE dbo.room_bookings
        ADD CONSTRAINT FK_room_bookings_users
            FOREIGN KEY (requester_username) REFERENCES dbo.users(username);

    ALTER TABLE dbo.room_bookings
        ADD CONSTRAINT FK_room_bookings_rooms
            FOREIGN KEY (room_code) REFERENCES dbo.rooms(code);

    -- Chỉ mục tối ưu hóa tìm kiếm lịch đặt phòng
    CREATE INDEX IX_room_bookings_room_code_date ON dbo.room_bookings(room_code, booking_date);
    CREATE INDEX IX_room_bookings_requester_username ON dbo.room_bookings(requester_username);
    CREATE INDEX IX_room_bookings_status ON dbo.room_bookings(status);
END
GO
