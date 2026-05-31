-- Bước 5: tạo bảng devices để thay cho dữ liệu hardcode ở frontend
-- Chạy trên SQL Server (SmarterASP) sau khi đã chạy:
--   - db/002_tables_lookups.sql
--   - db/003_seed_lookups.sql

SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.devices', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.devices
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_devices PRIMARY KEY,
        code NVARCHAR(50) NOT NULL CONSTRAINT UQ_devices_code UNIQUE,
        name NVARCHAR(150) NOT NULL,
        category_code NVARCHAR(50) NOT NULL,
        subject_code NVARCHAR(50) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_devices_status DEFAULT(N'available'),
        quantity INT NOT NULL CONSTRAINT DF_devices_quantity DEFAULT(1),
        description NVARCHAR(MAX) NULL,
        image_file NVARCHAR(255) NULL,
        sort_order INT NOT NULL CONSTRAINT DF_devices_sort_order DEFAULT(0),
        is_active BIT NOT NULL CONSTRAINT DF_devices_is_active DEFAULT(1),
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_devices_created_at DEFAULT(SYSUTCDATETIME())
    );

    CREATE INDEX IX_devices_category_code ON dbo.devices(category_code);
    CREATE INDEX IX_devices_subject_code ON dbo.devices(subject_code);
    CREATE INDEX IX_devices_status ON dbo.devices(status);
END
GO