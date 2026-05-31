-- Bước 4: Stored procedures lookup cho dropdown/checkbox
-- Chạy sau khi đã chạy:
--   - db/002_tables_lookups.sql
--   - db/003_seed_lookups.sql

SET NOCOUNT ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Lookups_DeviceFilters
AS
BEGIN
    SET NOCOUNT ON;

    -- Result set 1: categories
    SELECT
        c.code  AS [value],
        c.name  AS [label]
    FROM dbo.categories AS c
    WHERE c.is_active = 1
    ORDER BY c.sort_order, c.name;

    -- Result set 2: subjects
    SELECT
        s.code AS [value],
        s.name AS [label]
    FROM dbo.subjects AS s
    WHERE s.is_active = 1
    ORDER BY s.sort_order, s.name;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Lookups_RoomBooking
AS
BEGIN
    SET NOCOUNT ON;

    -- Result set 1: room types
    SELECT
        rt.code AS [value],
        rt.name AS [label]
    FROM dbo.room_types AS rt
    WHERE rt.is_active = 1
    ORDER BY rt.sort_order, rt.name;

    -- Result set 2: rooms
    SELECT
        r.code AS [value],
        r.name AS [label]
    FROM dbo.rooms AS r
    WHERE r.is_active = 1
    ORDER BY r.sort_order, r.name;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Lookups_UsersForSelect
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.username AS [value],
        u.full_name AS [label]
    FROM dbo.users AS u
    WHERE u.status = N'active'
    ORDER BY u.full_name;
END
GO
