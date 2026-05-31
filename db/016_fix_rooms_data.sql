-- db/016_fix_rooms_data.sql
-- Cập nhật liên kết room_type_id cho các phòng 101 và 102 sau khi seed dữ liệu
-- Chạy trên SQL Server (SmarterASP) sau khi đã chạy db/002_tables_lookups.sql và db/003_seed_lookups.sql

SET NOCOUNT ON;
GO

-- Cập nhật phòng 101 thuộc loại phòng cntt (Phòng máy tính)
UPDATE dbo.rooms
SET room_type_id = (SELECT id FROM dbo.room_types WHERE code = N'cntt')
WHERE code = N'101' AND room_type_id IS NULL;

-- Cập nhật phòng 102 thuộc loại phòng ly (Phòng thí nghiệm Vật lý)
UPDATE dbo.rooms
SET room_type_id = (SELECT id FROM dbo.room_types WHERE code = N'ly')
WHERE code = N'102' AND room_type_id IS NULL;

-- Xác minh dữ liệu phòng học sau khi cập nhật
SELECT 
    r.id,
    r.code AS room_code,
    r.name AS room_name,
    rt.name AS room_type_name
FROM dbo.rooms AS r
LEFT JOIN dbo.room_types AS rt ON r.room_type_id = rt.id;
GO
