-- Bước 4: tạo các bảng lookup tối thiểu cho dropdown/checkbox
-- Chạy trên SQL Server (SmarterASP) trong đúng database của dự án

SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.categories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.categories
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_categories PRIMARY KEY,
        code NVARCHAR(50) NOT NULL CONSTRAINT UQ_categories_code UNIQUE,
        name NVARCHAR(100) NOT NULL,
        sort_order INT NOT NULL CONSTRAINT DF_categories_sort_order DEFAULT(0),
        is_active BIT NOT NULL CONSTRAINT DF_categories_is_active DEFAULT(1),
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_categories_created_at DEFAULT(SYSUTCDATETIME())
    );
END
GO

IF OBJECT_ID('dbo.subjects', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.subjects
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_subjects PRIMARY KEY,
        code NVARCHAR(50) NOT NULL CONSTRAINT UQ_subjects_code UNIQUE,
        name NVARCHAR(100) NOT NULL,
        sort_order INT NOT NULL CONSTRAINT DF_subjects_sort_order DEFAULT(0),
        is_active BIT NOT NULL CONSTRAINT DF_subjects_is_active DEFAULT(1),
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_subjects_created_at DEFAULT(SYSUTCDATETIME())
    );
END
GO

IF OBJECT_ID('dbo.room_types', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.room_types
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_room_types PRIMARY KEY,
        code NVARCHAR(50) NOT NULL CONSTRAINT UQ_room_types_code UNIQUE,
        name NVARCHAR(100) NOT NULL,
        sort_order INT NOT NULL CONSTRAINT DF_room_types_sort_order DEFAULT(0),
        is_active BIT NOT NULL CONSTRAINT DF_room_types_is_active DEFAULT(1),
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_room_types_created_at DEFAULT(SYSUTCDATETIME())
    );
END
GO

IF OBJECT_ID('dbo.rooms', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rooms
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_rooms PRIMARY KEY,
        room_type_id INT NULL,
        code NVARCHAR(50) NOT NULL CONSTRAINT UQ_rooms_code UNIQUE,
        name NVARCHAR(100) NOT NULL,
        sort_order INT NOT NULL CONSTRAINT DF_rooms_sort_order DEFAULT(0),
        is_active BIT NOT NULL CONSTRAINT DF_rooms_is_active DEFAULT(1),
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_rooms_created_at DEFAULT(SYSUTCDATETIME())
    );

    -- FK (nullable để seed nhanh; có thể siết chặt ở bước sau)
    ALTER TABLE dbo.rooms
        ADD CONSTRAINT FK_rooms_room_types
            FOREIGN KEY (room_type_id) REFERENCES dbo.room_types(id);
END
GO

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.users
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
        username NVARCHAR(50) NOT NULL CONSTRAINT UQ_users_username UNIQUE,
        email NVARCHAR(255) NULL,
        password_hash NVARCHAR(255) NULL,
        full_name NVARCHAR(150) NOT NULL,
        phone NVARCHAR(30) NULL,
        role NVARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT(N'user'),
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT(N'active'),
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_users_created_at DEFAULT(SYSUTCDATETIME())
    );
END
GO
