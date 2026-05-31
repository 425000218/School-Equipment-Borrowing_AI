-- Bước 6: stored procedures cho luồng mượn/trả
-- Chạy sau khi đã chạy:
--   - db/008_tables_borrow_requests.sql

SET NOCOUNT ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_BorrowRequests_Create
    @RequesterUsername NVARCHAR(50),
    @DeviceCode NVARCHAR(50),
    @Quantity INT,
    @NeedDate DATE,
    @Note NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RequesterFullName NVARCHAR(150);
    DECLARE @DeviceName NVARCHAR(150);
    DECLARE @CategoryName NVARCHAR(100);
    DECLARE @SubjectName NVARCHAR(100);
    DECLARE @ImageUrl NVARCHAR(255);

    SELECT @RequesterFullName = u.full_name
    FROM dbo.users AS u
    WHERE u.username = @RequesterUsername
      AND u.status = N'active';

    IF @RequesterFullName IS NULL
    BEGIN
        THROW 50001, 'Requester not found', 1;
    END

    SELECT TOP (1)
        @DeviceName = d.name,
        @CategoryName = c.name,
        @SubjectName = s.name,
        @ImageUrl = CASE
            WHEN d.image_file IS NULL OR LTRIM(RTRIM(d.image_file)) = N'' THEN NULL
            WHEN LEFT(d.image_file, 1) = N'/' THEN d.image_file
            ELSE CONCAT(N'/Images/devices/', d.image_file)
        END
    FROM dbo.devices AS d
    INNER JOIN dbo.categories AS c ON c.code = d.category_code AND c.is_active = 1
    INNER JOIN dbo.subjects AS s ON s.code = d.subject_code AND s.is_active = 1
    WHERE d.code = @DeviceCode
      AND d.is_active = 1;

    IF @DeviceName IS NULL
    BEGIN
        THROW 50002, 'Device not found', 1;
    END

    DECLARE @RequestNo NVARCHAR(30) = CONCAT(N'BR-', FORMAT(SYSUTCDATETIME(), 'yyyyMMddHHmmss'), N'-', RIGHT(CONCAT(N'0000', CAST(ABS(CHECKSUM(NEWID())) % 10000 AS NVARCHAR(4))), 4));

    INSERT INTO dbo.borrow_requests
    (
        request_no,
        requester_username,
        requester_full_name,
        need_date,
        note,
        status,
        created_at,
        updated_at
    )
    VALUES
    (
        @RequestNo,
        @RequesterUsername,
        @RequesterFullName,
        @NeedDate,
        @Note,
        N'pending',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );

    DECLARE @BorrowRequestId INT = SCOPE_IDENTITY();

    INSERT INTO dbo.borrow_request_items
    (
        borrow_request_id,
        device_code,
        device_name,
        category_name,
        subject_name,
        quantity,
        image_url
    )
    VALUES
    (
        @BorrowRequestId,
        @DeviceCode,
        @DeviceName,
        @CategoryName,
        @SubjectName,
        @Quantity,
        @ImageUrl
    );

    SELECT
        br.id,
        br.request_no AS requestNo,
        br.requester_username AS requesterUsername,
        br.requester_full_name AS requesterFullName,
        br.need_date AS needDate,
        br.status,
        br.created_at AS createdAt,
        bri.device_code AS deviceCode,
        bri.device_name AS deviceName,
        bri.category_name AS categoryName,
        bri.subject_name AS subjectName,
        bri.quantity,
        bri.image_url AS imageUrl
    FROM dbo.borrow_requests AS br
    INNER JOIN dbo.borrow_request_items AS bri ON bri.borrow_request_id = br.id
    WHERE br.id = @BorrowRequestId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_BorrowRequests_ListByUser
    @RequesterUsername NVARCHAR(50),
    @Status NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        br.id,
        br.request_no AS requestNo,
        br.requester_username AS requesterUsername,
        br.requester_full_name AS requesterFullName,
        br.need_date AS needDate,
        br.status,
        br.note,
        br.created_at AS createdAt,
        br.updated_at AS updatedAt,
        bri.device_code AS deviceCode,
        bri.device_name AS deviceName,
        bri.category_name AS categoryName,
        bri.subject_name AS subjectName,
        bri.quantity,
        bri.image_url AS imageUrl
    FROM dbo.borrow_requests AS br
    INNER JOIN dbo.borrow_request_items AS bri ON bri.borrow_request_id = br.id
    WHERE br.requester_username = @RequesterUsername
      AND (@Status IS NULL OR br.status = @Status)
    ORDER BY br.created_at DESC, br.id DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_BorrowRequests_ApplyAction
    @RequestNo NVARCHAR(30),
    @Action NVARCHAR(20),
    @ActorUsername NVARCHAR(50) = NULL,
    @Note NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewStatus NVARCHAR(20);
    DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

    SET @NewStatus = CASE LOWER(@Action)
        WHEN N'approve' THEN N'approved'
        WHEN N'reject' THEN N'rejected'
        WHEN N'checkout' THEN N'checked_out'
        WHEN N'return' THEN N'returned'
        ELSE NULL
    END;

    IF @NewStatus IS NULL
    BEGIN
        THROW 50003, 'Invalid action', 1;
    END

    UPDATE dbo.borrow_requests
    SET status = @NewStatus,
        handled_by = @ActorUsername,
        handled_note = @Note,
        approved_at = CASE WHEN @NewStatus = N'approved' THEN @Now ELSE approved_at END,
        checked_out_at = CASE WHEN @NewStatus = N'checked_out' THEN @Now ELSE checked_out_at END,
        returned_at = CASE WHEN @NewStatus = N'returned' THEN @Now ELSE returned_at END,
        updated_at = @Now
    WHERE request_no = @RequestNo;

    IF @@ROWCOUNT = 0
    BEGIN
        THROW 50004, 'Request not found', 1;
    END

    SELECT
        br.id,
        br.request_no AS requestNo,
        br.requester_username AS requesterUsername,
        br.requester_full_name AS requesterFullName,
        br.need_date AS needDate,
        br.status,
        br.note,
        br.created_at AS createdAt,
        br.updated_at AS updatedAt,
        br.approved_at AS approvedAt,
        br.checked_out_at AS checkedOutAt,
        br.returned_at AS returnedAt,
        bri.device_code AS deviceCode,
        bri.device_name AS deviceName,
        bri.category_name AS categoryName,
        bri.subject_name AS subjectName,
        bri.quantity,
        bri.image_url AS imageUrl
    FROM dbo.borrow_requests AS br
    INNER JOIN dbo.borrow_request_items AS bri ON bri.borrow_request_id = br.id
    WHERE br.request_no = @RequestNo;
END
GO