-- Bước 5: stored procedure tìm danh sách thiết bị cho trang kho
-- Chạy sau khi đã chạy:
--   - db/005_tables_devices.sql
--   - db/006_seed_devices.sql

SET NOCOUNT ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Devices_Search
    @Search NVARCHAR(100) = NULL,
    @CategoryCode NVARCHAR(50) = NULL,
    @SubjectCode NVARCHAR(50) = NULL,
    @Status NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        d.code AS [id],
        d.name,
        c.name AS [category],
        s.name AS [subject],
        d.status,
        d.quantity,
        d.description,
        CASE
            WHEN d.image_file IS NULL OR LTRIM(RTRIM(d.image_file)) = N'' THEN NULL
            WHEN LEFT(d.image_file, 1) = N'/' THEN d.image_file
            ELSE CONCAT(N'/Images/devices/', d.image_file)
        END AS [image_url]
    FROM dbo.devices AS d
    INNER JOIN dbo.categories AS c
        ON c.code = d.category_code
       AND c.is_active = 1
    INNER JOIN dbo.subjects AS s
        ON s.code = d.subject_code
       AND s.is_active = 1
    WHERE d.is_active = 1
      AND (@Search IS NULL OR d.code LIKE N'%' + @Search + N'%' OR d.name LIKE N'%' + @Search + N'%')
      AND (@CategoryCode IS NULL OR d.category_code = @CategoryCode)
      AND (@SubjectCode IS NULL OR d.subject_code = @SubjectCode)
      AND (@Status IS NULL OR d.status = @Status)
    ORDER BY d.sort_order, d.name;
END
GO