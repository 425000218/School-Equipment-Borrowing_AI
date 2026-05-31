-- Fix password_hash for demo users gv-a and gv-b
-- Fill in a temporary password when running this script locally or on SmarterASP.
-- Do not commit the real password or hash into git.

SET NOCOUNT ON;
GO

DECLARE @DemoPassword NVARCHAR(200) = N'<ENTER_TEMPORARY_PASSWORD_HERE>';

IF @DemoPassword = N'<ENTER_TEMPORARY_PASSWORD_HERE>'
BEGIN
    THROW 50000, 'Please replace <ENTER_TEMPORARY_PASSWORD_HERE> before running this script.', 1;
END

-- Ensure the users exist and update their password_hash to SHA2_256 hex string
MERGE dbo.users AS tgt
USING (VALUES
    (N'gv-a', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @DemoPassword), 2)),
    (N'gv-b', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @DemoPassword), 2))
) AS src(username, new_hash)
ON tgt.username = src.username
WHEN MATCHED THEN
    UPDATE SET
        tgt.password_hash = src.new_hash,
        tgt.status = N'active';

-- Optional: show the updated rows for verification
SELECT username, full_name, role, status, password_hash
FROM dbo.users
WHERE username IN (N'gv-a', N'gv-b');

-- Also print expected hash for manual comparison
SELECT CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @DemoPassword), 2) AS expected_hash;

GO
