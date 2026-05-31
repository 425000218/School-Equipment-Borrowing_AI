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

app.Run();

record LookupOption(string value, string label);
