-- Bước 6: bảng cho luồng mượn/trả
-- Chạy sau khi đã chạy:
--   - db/002_tables_lookups.sql
--   - db/003_seed_lookups.sql
--   - db/005_tables_devices.sql
--   - db/006_seed_devices.sql

SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.borrow_requests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.borrow_requests
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_borrow_requests PRIMARY KEY,
        request_no NVARCHAR(30) NOT NULL CONSTRAINT UQ_borrow_requests_request_no UNIQUE,
        requester_username NVARCHAR(50) NOT NULL,
        requester_full_name NVARCHAR(150) NULL,
        need_date DATE NOT NULL,
        note NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_borrow_requests_status DEFAULT(N'pending'),
        handled_by NVARCHAR(50) NULL,
        handled_note NVARCHAR(MAX) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_borrow_requests_created_at DEFAULT(SYSUTCDATETIME()),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_borrow_requests_updated_at DEFAULT(SYSUTCDATETIME()),
        approved_at DATETIME2(3) NULL,
        checked_out_at DATETIME2(3) NULL,
        returned_at DATETIME2(3) NULL
    );

    ALTER TABLE dbo.borrow_requests
        ADD CONSTRAINT FK_borrow_requests_users
            FOREIGN KEY (requester_username) REFERENCES dbo.users(username);

    CREATE INDEX IX_borrow_requests_requester_username ON dbo.borrow_requests(requester_username);
    CREATE INDEX IX_borrow_requests_status ON dbo.borrow_requests(status);
    CREATE INDEX IX_borrow_requests_created_at ON dbo.borrow_requests(created_at DESC);
END
GO

IF OBJECT_ID('dbo.borrow_request_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.borrow_request_items
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_borrow_request_items PRIMARY KEY,
        borrow_request_id INT NOT NULL,
        device_code NVARCHAR(50) NOT NULL,
        device_name NVARCHAR(150) NOT NULL,
        category_name NVARCHAR(100) NOT NULL,
        subject_name NVARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        image_url NVARCHAR(255) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_borrow_request_items_created_at DEFAULT(SYSUTCDATETIME())
    );

    ALTER TABLE dbo.borrow_request_items
        ADD CONSTRAINT FK_borrow_request_items_borrow_requests
            FOREIGN KEY (borrow_request_id) REFERENCES dbo.borrow_requests(id) ON DELETE CASCADE;

    ALTER TABLE dbo.borrow_request_items
        ADD CONSTRAINT FK_borrow_request_items_devices
            FOREIGN KEY (device_code) REFERENCES dbo.devices(code);

    CREATE INDEX IX_borrow_request_items_borrow_request_id ON dbo.borrow_request_items(borrow_request_id);
    CREATE INDEX IX_borrow_request_items_device_code ON dbo.borrow_request_items(device_code);
END
GO