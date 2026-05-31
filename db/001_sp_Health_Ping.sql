-- Bước 3: stored procedure kiểm tra kết nối DB
-- Chạy trên SQL Server (SmarterASP) trong đúng database của dự án

CREATE OR ALTER PROCEDURE dbo.sp_Health_Ping
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        CAST(1 AS bit)        AS ok,
        SYSUTCDATETIME()      AS utc,
        @@SERVERNAME          AS server_name,
        DB_NAME()             AS database_name;
END
GO
