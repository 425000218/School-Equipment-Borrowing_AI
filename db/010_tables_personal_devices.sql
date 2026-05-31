-- db/010_tables_personal_devices.sql
-- Tạo bảng lưu kho cá nhân (personal devices)

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.personal_devices') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.personal_devices (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(50) NOT NULL,
        device_code NVARCHAR(50) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE UNIQUE INDEX IX_personal_devices_user_device ON dbo.personal_devices(username, device_code);
END
