using Microsoft.Data.SqlClient;
using System.Data;

var builder = WebApplication.CreateBuilder(args);

static string? GetMssqlConnectionString(IConfiguration config)
{
    return config.GetConnectionString("Mssql")
        ?? config["MSSQL_CONNECTION_STRING"];
}

static async Task<List<LookupOption>> ReadLookupOptionsAsync(SqlDataReader reader, CancellationToken ct)
{
    var list = new List<LookupOption>();
    while (await reader.ReadAsync(ct))
    {
        var value = reader.IsDBNull(0) ? null : reader.GetString(0);
        var label = reader.IsDBNull(1) ? null : reader.GetString(1);

        if (!string.IsNullOrWhiteSpace(value) && label is not null)
        {
            list.Add(new LookupOption(value, label));
        }
    }

    return list;
}

static string? ReadNullableString(SqlDataReader reader, string columnName)
{
    var ordinal = reader.GetOrdinal(columnName);
    return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
}

static int? ReadNullableInt32(SqlDataReader reader, string columnName)
{
    var ordinal = reader.GetOrdinal(columnName);
    return reader.IsDBNull(ordinal) ? null : reader.GetInt32(ordinal);
}

static DateTime? ReadNullableDateTime(SqlDataReader reader, string columnName)
{
    var ordinal = reader.GetOrdinal(columnName);
    return reader.IsDBNull(ordinal) ? null : DateTime.SpecifyKind(reader.GetDateTime(ordinal), DateTimeKind.Utc);
}

// Railway (và nhiều PaaS) cung cấp cổng chạy qua biến môi trường PORT.
// Nếu ASPNETCORE_URLS chưa được set, ta bind Kestrel vào 0.0.0.0:PORT.
var port = Environment.GetEnvironmentVariable("PORT");
var aspNetCoreUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (!string.IsNullOrWhiteSpace(port) && string.IsNullOrWhiteSpace(aspNetCoreUrls))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

var app = builder.Build();

// Static frontend (multi-page) nằm trong wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Health check endpoint (bước 2)
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    utc = DateTimeOffset.UtcNow
}));

// DB connectivity check (Bước 3): chỉ gọi stored procedure
app.MapGet("/api/db/ping", async (IConfiguration config, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_Health_Ping", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 10
        };

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return Results.Problem(
                detail: "sp_Health_Ping returned no rows.",
                statusCode: StatusCodes.Status502BadGateway);
        }

        var ok = !reader.IsDBNull(0) && reader.GetBoolean(0);
        var dbUtc = reader.IsDBNull(1)
            ? (DateTime?)null
            : DateTime.SpecifyKind(reader.GetDateTime(1), DateTimeKind.Utc);
        var server = reader.IsDBNull(2) ? null : reader.GetString(2);
        var database = reader.IsDBNull(3) ? null : reader.GetString(3);

        return Results.Ok(new
        {
            status = ok ? "ok" : "warning",
            utc = DateTimeOffset.UtcNow,
            db = new
            {
                ok,
                utc = dbUtc,
                server,
                database
            }
        });
    }
    catch (SqlException)
    {
        return Results.Problem(
            detail: "db_unavailable",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

// Lookup endpoints (Bước 4): chỉ gọi stored procedure
app.MapGet("/api/lookups/device-filters", async (IConfiguration config, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_Lookups_DeviceFilters", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        await using var reader = await command.ExecuteReaderAsync(ct);
        var categories = await ReadLookupOptionsAsync(reader, ct);

        var subjects = new List<LookupOption>();
        if (await reader.NextResultAsync(ct))
        {
            subjects = await ReadLookupOptionsAsync(reader, ct);
        }

        return Results.Ok(new { categories, subjects });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(
            detail: "stored_procedure_missing",
            statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(
            detail: "db_unavailable",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapGet("/api/lookups/room-booking", async (IConfiguration config, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_Lookups_RoomBooking", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        await using var reader = await command.ExecuteReaderAsync(ct);
        var roomTypes = await ReadLookupOptionsAsync(reader, ct);

        var rooms = new List<LookupOption>();
        if (await reader.NextResultAsync(ct))
        {
            rooms = await ReadLookupOptionsAsync(reader, ct);
        }

        return Results.Ok(new { roomTypes, rooms });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(
            detail: "stored_procedure_missing",
            statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(
            detail: "db_unavailable",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapGet("/api/lookups/users", async (IConfiguration config, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_Lookups_UsersForSelect", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        await using var reader = await command.ExecuteReaderAsync(ct);
        var users = await ReadLookupOptionsAsync(reader, ct);

        return Results.Ok(new { users });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(
            detail: "stored_procedure_missing",
            statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(
            detail: "db_unavailable",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

// Device catalog endpoint (Bước 5): chỉ gọi stored procedure
app.MapGet("/api/devices", async (
    IConfiguration config,
    string? search,
    string? category,
    string? subject,
    string? status,
    CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_Devices_Search", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 20
        };

        command.Parameters.Add(new SqlParameter("@Search", SqlDbType.NVarChar, 100)
        {
            Value = string.IsNullOrWhiteSpace(search) ? DBNull.Value : search.Trim()
        });
        command.Parameters.Add(new SqlParameter("@CategoryCode", SqlDbType.NVarChar, 50)
        {
            Value = string.IsNullOrWhiteSpace(category) ? DBNull.Value : category.Trim()
        });
        command.Parameters.Add(new SqlParameter("@SubjectCode", SqlDbType.NVarChar, 50)
        {
            Value = string.IsNullOrWhiteSpace(subject) ? DBNull.Value : subject.Trim()
        });
        command.Parameters.Add(new SqlParameter("@Status", SqlDbType.NVarChar, 20)
        {
            Value = string.IsNullOrWhiteSpace(status) ? DBNull.Value : status.Trim()
        });

        await using var reader = await command.ExecuteReaderAsync(ct);
        var devices = new List<object>();

        while (await reader.ReadAsync(ct))
        {
            var id = reader.IsDBNull(reader.GetOrdinal("id")) ? null : reader.GetString(reader.GetOrdinal("id"));
            var name = reader.IsDBNull(reader.GetOrdinal("name")) ? null : reader.GetString(reader.GetOrdinal("name"));
            var categoryLabel = reader.IsDBNull(reader.GetOrdinal("category")) ? null : reader.GetString(reader.GetOrdinal("category"));
            var subjectLabel = reader.IsDBNull(reader.GetOrdinal("subject")) ? null : reader.GetString(reader.GetOrdinal("subject"));
            var deviceStatus = reader.IsDBNull(reader.GetOrdinal("status")) ? "unavailable" : reader.GetString(reader.GetOrdinal("status"));
            var quantity = reader.IsDBNull(reader.GetOrdinal("quantity")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("quantity"));
            var description = reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description"));
            var imageUrl = reader.IsDBNull(reader.GetOrdinal("image_url")) ? null : reader.GetString(reader.GetOrdinal("image_url"));

            devices.Add(new
            {
                id,
                name,
                category = categoryLabel,
                subject = subjectLabel,
                status = deviceStatus,
                quantity,
                description,
                imageUrl
            });
        }

        return Results.Ok(new { devices });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(
            detail: "stored_procedure_missing",
            statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(
            detail: "db_unavailable",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

// Personal devices (kho cá nhân) endpoints
app.MapGet("/api/me/favorites", async (IConfiguration config, string? username, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    if (string.IsNullOrWhiteSpace(username))
    {
        return Results.BadRequest(new { error = "missing_username" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_MyDevices_ListByUser", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = username.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        var devices = new List<object>();
        while (await reader.ReadAsync(ct))
        {
            devices.Add(new
            {
                id = reader.GetString(reader.GetOrdinal("id")),
                name = reader.IsDBNull(reader.GetOrdinal("name")) ? null : reader.GetString(reader.GetOrdinal("name")),
                category = reader.IsDBNull(reader.GetOrdinal("category")) ? null : reader.GetString(reader.GetOrdinal("category")),
                subject = reader.IsDBNull(reader.GetOrdinal("subject")) ? null : reader.GetString(reader.GetOrdinal("subject")),
                quantity = reader.IsDBNull(reader.GetOrdinal("quantity")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("quantity")),
                imageUrl = reader.IsDBNull(reader.GetOrdinal("imageUrl")) ? null : reader.GetString(reader.GetOrdinal("imageUrl")),
                addedAt = reader.GetDateTime(reader.GetOrdinal("created_at"))
            });
        }

        return Results.Ok(new { devices });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(detail: "stored_procedure_missing", statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(detail: "db_unavailable", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapPost("/api/me/favorites", async (IConfiguration config, FavoriteRequest body, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.DeviceCode))
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_MyDevices_Add", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = body.Username.Trim() });
        command.Parameters.Add(new SqlParameter("@DeviceCode", SqlDbType.NVarChar, 50) { Value = body.DeviceCode.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return Results.Problem(detail: "favorite_add_failed", statusCode: StatusCodes.Status502BadGateway);
        }

        var result = reader.GetInt32(0);
        if (result == -1)
        {
            return Results.Ok(new { added = false, reason = "already_exists" });
        }

        return Results.Ok(new { added = true });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(detail: "stored_procedure_missing", statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(detail: "db_unavailable", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

// Fallback delete endpoint (POST) to support environments that restrict DELETE payloads
app.MapPost("/api/me/favorites/remove", async (IConfiguration config, FavoriteRequest body, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    if (body is null || string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.DeviceCode))
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_MyDevices_Remove", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = body.Username.Trim() });
        command.Parameters.Add(new SqlParameter("@DeviceCode", SqlDbType.NVarChar, 50) { Value = body.DeviceCode.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return Results.Problem(detail: "favorite_remove_failed", statusCode: StatusCodes.Status502BadGateway);
        }

        var deleted = reader.GetInt32(0);
        return Results.Ok(new { deleted });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(detail: "stored_procedure_missing", statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(detail: "db_unavailable", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapDelete("/api/me/favorites/{deviceCode}", async (HttpContext httpContext, IConfiguration config, string deviceCode, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    // Robustly obtain username: prefer querystring, fall back to headers (username or X-Username)
    var username = httpContext.Request.Query["username"].ToString();
    if (string.IsNullOrWhiteSpace(username))
    {
        if (httpContext.Request.Headers.TryGetValue("username", out var hv) && !string.IsNullOrWhiteSpace(hv.ToString()))
        {
            username = hv.ToString();
        }
        else if (httpContext.Request.Headers.TryGetValue("X-Username", out hv) && !string.IsNullOrWhiteSpace(hv.ToString()))
        {
            username = hv.ToString();
        }
    }

    // If still empty, try to read JSON body (some clients send username in body on DELETE)
    if (string.IsNullOrWhiteSpace(username) && httpContext.Request.ContentLength > 0)
    {
        try
        {
            httpContext.Request.EnableBuffering();
            using var sr = new StreamReader(httpContext.Request.Body, leaveOpen: true);
            var bodyText = await sr.ReadToEndAsync();
            httpContext.Request.Body.Position = 0;
            if (!string.IsNullOrWhiteSpace(bodyText))
            {
                using var doc = System.Text.Json.JsonDocument.Parse(bodyText);
                if (doc.RootElement.TryGetProperty("username", out var p) && p.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    username = p.GetString();
                }
                else if (doc.RootElement.TryGetProperty("Username", out p) && p.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    username = p.GetString();
                }
            }
        }
        catch
        {
            // ignore parse errors and continue
        }
    }

    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(deviceCode))
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_MyDevices_Remove", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = username.Trim() });
        command.Parameters.Add(new SqlParameter("@DeviceCode", SqlDbType.NVarChar, 50) { Value = deviceCode.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return Results.Problem(detail: "favorite_remove_failed", statusCode: StatusCodes.Status502BadGateway);
        }

        var deleted = reader.GetInt32(0);
        return Results.Ok(new { deleted });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(detail: "stored_procedure_missing", statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(detail: "db_unavailable", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapPost("/api/borrow-requests", async (IConfiguration config, BorrowRequestCreateRequest body, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    if (string.IsNullOrWhiteSpace(body.RequesterUsername) || string.IsNullOrWhiteSpace(body.DeviceCode) || body.Quantity <= 0)
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_BorrowRequests_Create", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 20
        };

        command.Parameters.Add(new SqlParameter("@RequesterUsername", SqlDbType.NVarChar, 50) { Value = body.RequesterUsername.Trim() });
        command.Parameters.Add(new SqlParameter("@DeviceCode", SqlDbType.NVarChar, 50) { Value = body.DeviceCode.Trim() });
        command.Parameters.Add(new SqlParameter("@Quantity", SqlDbType.Int) { Value = body.Quantity });
        command.Parameters.Add(new SqlParameter("@NeedDate", SqlDbType.Date) { Value = body.NeedDate.Date });
        command.Parameters.Add(new SqlParameter("@Note", SqlDbType.NVarChar, -1) { Value = string.IsNullOrWhiteSpace(body.Note) ? DBNull.Value : body.Note.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return Results.Problem(detail: "borrow_request_create_failed", statusCode: StatusCodes.Status502BadGateway);
        }

        return Results.Ok(new
        {
            id = reader.GetInt32(reader.GetOrdinal("id")),
            requestNo = reader.GetString(reader.GetOrdinal("requestNo")),
            requesterUsername = reader.GetString(reader.GetOrdinal("requesterUsername")),
            requesterFullName = ReadNullableString(reader, "requesterFullName"),
            needDate = reader.GetDateTime(reader.GetOrdinal("needDate")),
            status = reader.GetString(reader.GetOrdinal("status")),
            createdAt = reader.GetDateTime(reader.GetOrdinal("createdAt")),
            device = new
            {
                code = reader.GetString(reader.GetOrdinal("deviceCode")),
                name = reader.GetString(reader.GetOrdinal("deviceName")),
                category = reader.GetString(reader.GetOrdinal("categoryName")),
                subject = reader.GetString(reader.GetOrdinal("subjectName")),
                quantity = reader.GetInt32(reader.GetOrdinal("quantity")),
                imageUrl = ReadNullableString(reader, "imageUrl")
            }
        });
    }
    catch (SqlException ex) when (ex.Number == 50001 || ex.Number == 50002)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(detail: "stored_procedure_missing", statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(detail: "db_unavailable", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapGet("/api/borrow-requests", async (
    IConfiguration config,
    string? requesterUsername,
    string? status,
    CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    if (string.IsNullOrWhiteSpace(requesterUsername))
    {
        return Results.BadRequest(new { error = "missing_requester_username" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_BorrowRequests_ListByUser", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 20
        };

        command.Parameters.Add(new SqlParameter("@RequesterUsername", SqlDbType.NVarChar, 50) { Value = requesterUsername.Trim() });
        command.Parameters.Add(new SqlParameter("@Status", SqlDbType.NVarChar, 20) { Value = string.IsNullOrWhiteSpace(status) ? DBNull.Value : status.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        var requests = new List<object>();

        while (await reader.ReadAsync(ct))
        {
            requests.Add(new
            {
                id = reader.GetInt32(reader.GetOrdinal("id")),
                requestNo = reader.GetString(reader.GetOrdinal("requestNo")),
                requesterUsername = reader.GetString(reader.GetOrdinal("requesterUsername")),
                requesterFullName = ReadNullableString(reader, "requesterFullName"),
                needDate = reader.GetDateTime(reader.GetOrdinal("needDate")),
                status = reader.GetString(reader.GetOrdinal("status")),
                note = ReadNullableString(reader, "note"),
                createdAt = reader.GetDateTime(reader.GetOrdinal("createdAt")),
                updatedAt = reader.GetDateTime(reader.GetOrdinal("updatedAt")),
                device = new
                {
                    code = reader.GetString(reader.GetOrdinal("deviceCode")),
                    name = reader.GetString(reader.GetOrdinal("deviceName")),
                    category = reader.GetString(reader.GetOrdinal("categoryName")),
                    subject = reader.GetString(reader.GetOrdinal("subjectName")),
                    quantity = reader.GetInt32(reader.GetOrdinal("quantity")),
                    imageUrl = ReadNullableString(reader, "imageUrl")
                }
            });
        }

        return Results.Ok(new { requests });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(detail: "stored_procedure_missing", statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(detail: "db_unavailable", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapPost("/api/borrow-requests/{requestNo}/actions", async (
    IConfiguration config,
    string requestNo,
    BorrowRequestActionRequest body,
    CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    if (string.IsNullOrWhiteSpace(requestNo) || string.IsNullOrWhiteSpace(body.Action))
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_BorrowRequests_ApplyAction", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 20
        };

        command.Parameters.Add(new SqlParameter("@RequestNo", SqlDbType.NVarChar, 30) { Value = requestNo.Trim() });
        command.Parameters.Add(new SqlParameter("@Action", SqlDbType.NVarChar, 20) { Value = body.Action.Trim() });
        command.Parameters.Add(new SqlParameter("@ActorUsername", SqlDbType.NVarChar, 50) { Value = string.IsNullOrWhiteSpace(body.ActorUsername) ? DBNull.Value : body.ActorUsername.Trim() });
        command.Parameters.Add(new SqlParameter("@Note", SqlDbType.NVarChar, -1) { Value = string.IsNullOrWhiteSpace(body.Note) ? DBNull.Value : body.Note.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return Results.Problem(detail: "borrow_request_action_failed", statusCode: StatusCodes.Status502BadGateway);
        }

        return Results.Ok(new
        {
            requestNo = reader.GetString(reader.GetOrdinal("requestNo")),
            status = reader.GetString(reader.GetOrdinal("status")),
            requesterUsername = reader.GetString(reader.GetOrdinal("requesterUsername")),
            requesterFullName = ReadNullableString(reader, "requesterFullName"),
            needDate = reader.GetDateTime(reader.GetOrdinal("needDate")),
            note = ReadNullableString(reader, "note"),
            createdAt = reader.GetDateTime(reader.GetOrdinal("createdAt")),
            updatedAt = reader.GetDateTime(reader.GetOrdinal("updatedAt")),
            approvedAt = ReadNullableDateTime(reader, "approvedAt"),
            checkedOutAt = ReadNullableDateTime(reader, "checkedOutAt"),
            returnedAt = ReadNullableDateTime(reader, "returnedAt"),
            device = new
            {
                code = reader.GetString(reader.GetOrdinal("deviceCode")),
                name = reader.GetString(reader.GetOrdinal("deviceName")),
                category = reader.GetString(reader.GetOrdinal("categoryName")),
                subject = reader.GetString(reader.GetOrdinal("subjectName")),
                quantity = reader.GetInt32(reader.GetOrdinal("quantity")),
                imageUrl = ReadNullableString(reader, "imageUrl")
            }
        });
    }
    catch (SqlException ex) when (ex.Number == 50003 || ex.Number == 50004)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (SqlException ex) when (ex.Number == 2812)
    {
        return Results.Problem(detail: "stored_procedure_missing", statusCode: StatusCodes.Status502BadGateway);
    }
    catch (SqlException)
    {
        return Results.Problem(detail: "db_unavailable", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.Run();

record LookupOption(string value, string label);
record BorrowRequestCreateRequest(string RequesterUsername, string DeviceCode, int Quantity, DateTime NeedDate, string? Note);
record BorrowRequestActionRequest(string Action, string? ActorUsername, string? Note);
record FavoriteRequest(string Username, string DeviceCode);
