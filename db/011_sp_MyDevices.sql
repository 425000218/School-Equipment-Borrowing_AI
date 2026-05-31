-- db/011_sp_MyDevices.sql
-- Stored procedures to manage personal devices

-- sp_MyDevices_ListByUser
IF OBJECT_ID('dbo.sp_MyDevices_ListByUser', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_MyDevices_ListByUser;
GO
CREATE PROCEDURE dbo.sp_MyDevices_ListByUser @Username NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        pd.device_code AS id,
        COALESCE(d.name, pd.device_code) AS name,
        COALESCE(c.name, d.category_code, '') AS category,
        COALESCE(s.name, d.subject_code, '') AS subject,
        COALESCE(d.quantity, 1) AS quantity,
        COALESCE(d.image_file, '') AS imageUrl,
        pd.created_at
    FROM dbo.personal_devices pd
    LEFT JOIN dbo.devices d ON d.code = pd.device_code
    LEFT JOIN dbo.categories c ON c.code = d.category_code
    LEFT JOIN dbo.subjects s ON s.code = d.subject_code
    WHERE pd.username = @Username
    ORDER BY pd.created_at DESC;
END
GO

-- sp_MyDevices_Add
IF OBJECT_ID('dbo.sp_MyDevices_Add', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_MyDevices_Add;
GO
CREATE PROCEDURE dbo.sp_MyDevices_Add @Username NVARCHAR(50), @DeviceCode NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.personal_devices WHERE username = @Username AND device_code = @DeviceCode)
    BEGIN
        SELECT -1 AS result; -- already exists
        RETURN;
    END

    INSERT INTO dbo.personal_devices(username, device_code) VALUES(@Username, @DeviceCode);
    SELECT 1 AS result;
END
GO

-- sp_MyDevices_Remove
IF OBJECT_ID('dbo.sp_MyDevices_Remove', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_MyDevices_Remove;
GO
CREATE PROCEDURE dbo.sp_MyDevices_Remove @Username NVARCHAR(50), @DeviceCode NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.personal_devices WHERE username = @Username AND device_code = @DeviceCode;
    SELECT @@ROWCOUNT AS deletedCount;
END
GO
