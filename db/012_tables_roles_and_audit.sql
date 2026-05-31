-- Bước 6a: bổ sung role cho users và audit log cho mượn/trả
-- Chạy sau khi đã tạo bảng users / borrow_requests

SET NOCOUNT ON;
GO

IF COL_LENGTH('dbo.users', 'role') IS NULL
BEGIN
    ALTER TABLE dbo.users
    ADD role NVARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT(N'user');
END
GO

IF OBJECT_ID('dbo.borrow_request_audit_logs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.borrow_request_audit_logs
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_borrow_request_audit_logs PRIMARY KEY,
        borrow_request_id INT NOT NULL,
        request_no NVARCHAR(30) NOT NULL,
        action NVARCHAR(20) NOT NULL,
        previous_status NVARCHAR(20) NOT NULL,
        new_status NVARCHAR(20) NOT NULL,
        actor_username NVARCHAR(50) NOT NULL,
        actor_full_name NVARCHAR(150) NULL,
        note NVARCHAR(MAX) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_borrow_request_audit_logs_created_at DEFAULT(SYSUTCDATETIME())
    );

    ALTER TABLE dbo.borrow_request_audit_logs
        ADD CONSTRAINT FK_borrow_request_audit_logs_borrow_requests
            FOREIGN KEY (borrow_request_id) REFERENCES dbo.borrow_requests(id) ON DELETE CASCADE;

    CREATE INDEX IX_borrow_request_audit_logs_request_no ON dbo.borrow_request_audit_logs(request_no, created_at DESC);
    CREATE INDEX IX_borrow_request_audit_logs_actor_username ON dbo.borrow_request_audit_logs(actor_username, created_at DESC);
END
GO