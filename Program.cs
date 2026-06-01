using Microsoft.Data.SqlClient;
using System.Collections.Concurrent;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.HttpOverrides;

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

const string AuthCookieName = "seb_auth";
const int LoginMaxFailedAttempts = 10;

static string NormalizeLoginKey(string username)
{
    return (username ?? string.Empty).Trim().ToLowerInvariant();
}

static bool TryGetLoginLock(string loginKey, out int remainingSeconds)
{
    remainingSeconds = 0;
    if (string.IsNullOrWhiteSpace(loginKey) || !LoginThrottleStore.StateByUser.TryGetValue(loginKey, out var state))
    {
        return false;
    }

    var shouldRemove = false;
    lock (state)
    {
        var now = DateTimeOffset.UtcNow;

        if (state.LockedUntilUtc.HasValue && state.LockedUntilUtc.Value > now)
        {
            remainingSeconds = (int)Math.Ceiling((state.LockedUntilUtc.Value - now).TotalSeconds);
            return true;
        }

        if (state.LockedUntilUtc.HasValue && state.LockedUntilUtc.Value <= now)
        {
            state.LockedUntilUtc = null;
            state.FailedCount = 0;
            state.UpdatedAtUtc = now;
        }

        if (now - state.UpdatedAtUtc > LoginThrottleStore.StateTtl)
        {
            shouldRemove = true;
        }
    }

    if (shouldRemove)
    {
        LoginThrottleStore.StateByUser.TryRemove(loginKey, out _);
    }

    return false;
}

static LoginFailureResult RegisterLoginFailure(string loginKey)
{
    var now = DateTimeOffset.UtcNow;
    var state = LoginThrottleStore.StateByUser.GetOrAdd(loginKey, _ => new LoginThrottleState());

    lock (state)
    {
        if (state.LockedUntilUtc.HasValue && state.LockedUntilUtc.Value > now)
        {
            var remaining = (int)Math.Ceiling((state.LockedUntilUtc.Value - now).TotalSeconds);
            return new LoginFailureResult(true, remaining, 0);
        }

        if (state.LockedUntilUtc.HasValue && state.LockedUntilUtc.Value <= now)
        {
            state.LockedUntilUtc = null;
            state.FailedCount = 0;
        }

        state.FailedCount += 1;
        state.UpdatedAtUtc = now;

        if (state.FailedCount >= LoginMaxFailedAttempts)
        {
            state.LockedUntilUtc = now.Add(LoginThrottleStore.LockDuration);
            state.FailedCount = 0;
            var remaining = (int)Math.Ceiling(LoginThrottleStore.LockDuration.TotalSeconds);
            return new LoginFailureResult(true, remaining, 0);
        }

        return new LoginFailureResult(false, 0, state.FailedCount);
    }
}

static void ClearLoginFailures(string loginKey)
{
    if (!string.IsNullOrWhiteSpace(loginKey))
    {
        LoginThrottleStore.StateByUser.TryRemove(loginKey, out _);
    }
}

static string ComputeSha256Hex(string input)
{
    var bytes = Encoding.UTF8.GetBytes(input ?? string.Empty);
    var hash = SHA256.HashData(bytes);
    return Convert.ToHexString(hash).ToLowerInvariant();
}

static string Base64UrlEncode(byte[] bytes)
{
    return Convert.ToBase64String(bytes)
        .TrimEnd('=')
        .Replace('+', '-')
        .Replace('/', '_');
}

static byte[] Base64UrlDecode(string encoded)
{
    var normalized = encoded.Replace('-', '+').Replace('_', '/');
    var padding = 4 - (normalized.Length % 4);
    if (padding is > 0 and < 4)
    {
        normalized = normalized + new string('=', padding);
    }
    return Convert.FromBase64String(normalized);
}

static string GetAuthSecret(IConfiguration config)
{
    return config["AUTH_SECRET"]
        ?? config["Seb:AuthSecret"]
        ?? "seb-dev-only-change-this-secret";
}

static string CreateAuthToken(string username, string role, DateTimeOffset expiresUtc, string secret)
{
    var payload = $"{username}|{role}|{expiresUtc.ToUnixTimeSeconds()}";
    var payloadBytes = Encoding.UTF8.GetBytes(payload);
    var payloadEncoded = Base64UrlEncode(payloadBytes);

    var signatureBytes = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payloadEncoded));
    var signatureEncoded = Base64UrlEncode(signatureBytes);
    return $"{payloadEncoded}.{signatureEncoded}";
}

static AuthUser? ReadAuthUser(HttpContext httpContext, IConfiguration config)
{
    if (!httpContext.Request.Cookies.TryGetValue(AuthCookieName, out var token) || string.IsNullOrWhiteSpace(token))
    {
        return null;
    }

    var parts = token.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    if (parts.Length != 2)
    {
        return null;
    }

    var payloadEncoded = parts[0];
    var signatureEncoded = parts[1];

    var expectedSignature = Base64UrlEncode(HMACSHA256.HashData(
        Encoding.UTF8.GetBytes(GetAuthSecret(config)),
        Encoding.UTF8.GetBytes(payloadEncoded)));

    if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(signatureEncoded),
            Encoding.UTF8.GetBytes(expectedSignature)))
    {
        return null;
    }

    string payload;
    try
    {
        payload = Encoding.UTF8.GetString(Base64UrlDecode(payloadEncoded));
    }
    catch
    {
        return null;
    }

    var segments = payload.Split('|', StringSplitOptions.None);
    if (segments.Length != 3)
    {
        return null;
    }

    var username = segments[0];
    var role = segments[1];
    if (!long.TryParse(segments[2], out var expUnix))
    {
        return null;
    }

    var expiresUtc = DateTimeOffset.FromUnixTimeSeconds(expUnix);
    if (expiresUtc <= DateTimeOffset.UtcNow)
    {
        return null;
    }

    if (string.IsNullOrWhiteSpace(username))
    {
        return null;
    }

    return new AuthUser(username.Trim(), (role ?? "user").Trim().ToLowerInvariant(), expiresUtc);
}

static void SetAuthCookie(HttpContext httpContext, IConfiguration config, string username, string role, bool remember)
{
    var expiresUtc = DateTimeOffset.UtcNow.Add(remember ? TimeSpan.FromDays(7) : TimeSpan.FromHours(12));
    var token = CreateAuthToken(username, role, expiresUtc, GetAuthSecret(config));

    httpContext.Response.Cookies.Append(AuthCookieName, token, new CookieOptions
    {
        HttpOnly = true,
        Secure = httpContext.Request.IsHttps,
        SameSite = SameSiteMode.Lax,
        Expires = expiresUtc,
        Path = "/"
    });
}

static void ClearAuthCookie(HttpContext httpContext)
{
    httpContext.Response.Cookies.Delete(AuthCookieName, new CookieOptions
    {
        Path = "/",
        SameSite = SameSiteMode.Lax,
        Secure = httpContext.Request.IsHttps
    });
}

// Railway (và nhiều PaaS) cung cấp cổng chạy qua biến môi trường PORT.
// Nếu ASPNETCORE_URLS chưa được set, ta bind Kestrel vào 0.0.0.0:PORT.
var port = Environment.GetEnvironmentVariable("PORT");
var aspNetCoreUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (!string.IsNullOrWhiteSpace(port) && string.IsNullOrWhiteSpace(aspNetCoreUrls))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

// Static frontend (multi-page) nằm trong wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Health check endpoint (bước 2)
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    utc = DateTimeOffset.UtcNow
}));

app.MapPost("/api/auth/login", async (HttpContext httpContext, IConfiguration config, LoginRequest body, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    if (body is null || string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.Password))
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    var loginKey = NormalizeLoginKey(body.Username);
    if (string.IsNullOrWhiteSpace(loginKey))
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    if (TryGetLoginLock(loginKey, out var remainingBeforeLogin))
    {
        return Results.Json(new
        {
            error = "account_locked",
            retryAfterSeconds = remainingBeforeLogin,
            lockDurationMinutes = (int)LoginThrottleStore.LockDuration.TotalMinutes
        }, statusCode: StatusCodes.Status423Locked);
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand(@"
SELECT TOP (1)
    u.username,
    u.role,
    u.full_name,
    u.password_hash,
    u.status
FROM dbo.users AS u
WHERE u.username = @Username;", connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 15
        };

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = body.Username.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            var failure = RegisterLoginFailure(loginKey);
            if (failure.IsLocked)
            {
                return Results.Json(new
                {
                    error = "account_locked",
                    retryAfterSeconds = failure.RetryAfterSeconds,
                    lockDurationMinutes = (int)LoginThrottleStore.LockDuration.TotalMinutes
                }, statusCode: StatusCodes.Status423Locked);
            }

            return Results.Json(new
            {
                error = "invalid_credentials",
                attemptsRemaining = Math.Max(0, LoginMaxFailedAttempts - failure.CurrentFailedCount)
            }, statusCode: StatusCodes.Status401Unauthorized);
        }

        var status = ReadNullableString(reader, "status");
        if (!string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
        {
            var failure = RegisterLoginFailure(loginKey);
            if (failure.IsLocked)
            {
                return Results.Json(new
                {
                    error = "account_locked",
                    retryAfterSeconds = failure.RetryAfterSeconds,
                    lockDurationMinutes = (int)LoginThrottleStore.LockDuration.TotalMinutes
                }, statusCode: StatusCodes.Status423Locked);
            }

            return Results.Json(new
            {
                error = "invalid_credentials",
                attemptsRemaining = Math.Max(0, LoginMaxFailedAttempts - failure.CurrentFailedCount)
            }, statusCode: StatusCodes.Status401Unauthorized);
        }

        var passwordHash = ReadNullableString(reader, "password_hash");
        var incomingHash = ComputeSha256Hex(body.Password.Trim());
        if (string.IsNullOrWhiteSpace(passwordHash) || !string.Equals(passwordHash.Trim(), incomingHash, StringComparison.OrdinalIgnoreCase))
        {
            var failure = RegisterLoginFailure(loginKey);
            if (failure.IsLocked)
            {
                return Results.Json(new
                {
                    error = "account_locked",
                    retryAfterSeconds = failure.RetryAfterSeconds,
                    lockDurationMinutes = (int)LoginThrottleStore.LockDuration.TotalMinutes
                }, statusCode: StatusCodes.Status423Locked);
            }

            return Results.Json(new
            {
                error = "invalid_credentials",
                attemptsRemaining = Math.Max(0, LoginMaxFailedAttempts - failure.CurrentFailedCount)
            }, statusCode: StatusCodes.Status401Unauthorized);
        }

        var username = reader.GetString(reader.GetOrdinal("username")).Trim();
        var role = (ReadNullableString(reader, "role") ?? "user").Trim().ToLowerInvariant();
        var fullName = ReadNullableString(reader, "full_name");

        ClearLoginFailures(loginKey);
        SetAuthCookie(httpContext, config, username, role, body.Remember);

        return Results.Ok(new
        {
            user = new
            {
                username,
                role,
                fullName
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

app.MapGet("/api/auth/session", (HttpContext httpContext, IConfiguration config) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    string? fullName = null;
    string? status = null;
    try
    {
        using var connection = new SqlConnection(connectionString);
        connection.Open();

        using var command = new SqlCommand(@"
SELECT TOP (1)
    u.full_name,
    u.status
FROM dbo.users AS u
WHERE u.username = @Username;", connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 15
        };

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = authUser.Username });

        using var reader = command.ExecuteReader();
        if (reader.Read())
        {
            fullName = ReadNullableString(reader, "full_name");
            status = ReadNullableString(reader, "status");
        }
    }
    catch (SqlException)
    {
        return Results.Problem(
            detail: "db_unavailable",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (!string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
    {
        return Results.Unauthorized();
    }

    return Results.Ok(new
    {
        user = new
        {
            username = authUser.Username,
            role = authUser.Role,
            fullName,
            expiresAt = authUser.ExpiresAtUtc
        }
    });
});

app.MapPost("/api/auth/logout", (HttpContext httpContext) =>
{
    ClearAuthCookie(httpContext);
    return Results.Ok(new { ok = true });
});

// Admin: clear login lockout state for a user or all users
app.MapPost("/api/admin/clear-lockout", (HttpContext httpContext, IConfiguration config, ClearLockoutRequest body) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (!string.Equals(authUser.Role, "admin", StringComparison.OrdinalIgnoreCase))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    if (body is null)
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    if (!string.IsNullOrWhiteSpace(body.Username))
    {
        var key = NormalizeLoginKey(body.Username);
        if (string.IsNullOrWhiteSpace(key)) return Results.BadRequest(new { error = "invalid_username" });
        LoginThrottleStore.StateByUser.TryRemove(key, out _);
        return Results.Ok(new { ok = true, cleared = key });
    }

    // clear all when admin explicitly requests
    if (body.ClearAll)
    {
        LoginThrottleStore.StateByUser.Clear();
        return Results.Ok(new { ok = true, clearedAll = true });
    }

    return Results.BadRequest(new { error = "invalid_payload" });
});

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

app.MapGet("/api/lookups/approvers", async (IConfiguration config, CancellationToken ct) =>
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

        await using var command = new SqlCommand("dbo.sp_Lookups_ApproversForSelect", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        await using var reader = await command.ExecuteReaderAsync(ct);
        var approvers = await ReadLookupOptionsAsync(reader, ct);

        return Results.Ok(new { users = approvers });
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
app.MapGet("/api/me/favorites", async (HttpContext httpContext, IConfiguration config, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    var username = authUser.Username;

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

app.MapPost("/api/me/favorites", async (HttpContext httpContext, IConfiguration config, FavoriteRequest body, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(body.DeviceCode))
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

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = authUser.Username });
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
app.MapPost("/api/me/favorites/remove", async (HttpContext httpContext, IConfiguration config, FavoriteRequest body, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (body is null || string.IsNullOrWhiteSpace(body.DeviceCode))
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

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = authUser.Username });
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

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(deviceCode))
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

        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = authUser.Username });
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

app.MapPost("/api/borrow-requests", async (HttpContext httpContext, IConfiguration config, BorrowRequestCreateRequest body, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            detail: "Missing MSSQL connection string. Set ConnectionStrings__Mssql (recommended) or MSSQL_CONNECTION_STRING.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(body.DeviceCode) || body.Quantity <= 0)
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

        command.Parameters.Add(new SqlParameter("@RequesterUsername", SqlDbType.NVarChar, 50) { Value = authUser.Username });
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
    catch (SqlException ex) when (ex.Number == 50000)
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
    HttpContext httpContext,
    IConfiguration config,
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

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
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

        command.Parameters.Add(new SqlParameter("@RequesterUsername", SqlDbType.NVarChar, 50) { Value = authUser.Username });
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
    HttpContext httpContext,
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

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (authUser.Role != "admin" && authUser.Role != "approver")
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
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
        command.Parameters.Add(new SqlParameter("@ActorUsername", SqlDbType.NVarChar, 50) { Value = authUser.Username });
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
    catch (SqlException ex) when (ex.Number == 50000)
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

// Room Booking endpoints
app.MapGet("/api/room-bookings", async (
    HttpContext httpContext,
    IConfiguration config,
    string roomCode,
    DateTime startDate,
    DateTime endDate,
    CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(roomCode))
    {
        return Results.BadRequest(new { error = "invalid_room_code" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_RoomBookings_List", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 15
        };

        command.Parameters.Add(new SqlParameter("@RoomCode", SqlDbType.NVarChar, 50) { Value = roomCode.Trim() });
        command.Parameters.Add(new SqlParameter("@StartDate", SqlDbType.Date) { Value = startDate.Date });
        command.Parameters.Add(new SqlParameter("@EndDate", SqlDbType.Date) { Value = endDate.Date });

        await using var reader = await command.ExecuteReaderAsync(ct);
        var bookings = new List<object>();

        while (await reader.ReadAsync(ct))
        {
            bookings.Add(new
            {
                id = reader.GetInt32(reader.GetOrdinal("id")),
                bookingNo = reader.GetString(reader.GetOrdinal("bookingNo")),
                requesterUsername = reader.GetString(reader.GetOrdinal("requesterUsername")),
                requesterFullName = ReadNullableString(reader, "requesterFullName"),
                roomCode = reader.GetString(reader.GetOrdinal("roomCode")),
                roomName = reader.GetString(reader.GetOrdinal("roomName")),
                bookingDate = reader.GetDateTime(reader.GetOrdinal("bookingDate")),
                slot = reader.GetString(reader.GetOrdinal("slot")),
                purpose = ReadNullableString(reader, "purpose"),
                status = reader.GetString(reader.GetOrdinal("status")),
                createdAt = reader.GetDateTime(reader.GetOrdinal("createdAt"))
            });
        }

        return Results.Ok(new { bookings });
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

app.MapPost("/api/room-bookings", async (
    HttpContext httpContext,
    IConfiguration config,
    RoomBookingCreateRequest body,
    CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (body is null || string.IsNullOrWhiteSpace(body.RoomCode) || string.IsNullOrWhiteSpace(body.Slot))
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_RoomBookings_Create", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 20
        };

        command.Parameters.Add(new SqlParameter("@RequesterUsername", SqlDbType.NVarChar, 50) { Value = authUser.Username });
        command.Parameters.Add(new SqlParameter("@RoomCode", SqlDbType.NVarChar, 50) { Value = body.RoomCode.Trim() });
        command.Parameters.Add(new SqlParameter("@BookingDate", SqlDbType.Date) { Value = body.BookingDate.Date });
        command.Parameters.Add(new SqlParameter("@Slot", SqlDbType.NVarChar, 20) { Value = body.Slot.Trim() });
        command.Parameters.Add(new SqlParameter("@Purpose", SqlDbType.NVarChar, -1) { Value = string.IsNullOrWhiteSpace(body.Purpose) ? DBNull.Value : body.Purpose.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return Results.Problem(detail: "room_booking_create_failed", statusCode: StatusCodes.Status502BadGateway);
        }

        return Results.Ok(new
        {
            id = reader.GetInt32(reader.GetOrdinal("id")),
            bookingNo = reader.GetString(reader.GetOrdinal("bookingNo")),
            requesterUsername = reader.GetString(reader.GetOrdinal("requesterUsername")),
            requesterFullName = ReadNullableString(reader, "requesterFullName"),
            roomCode = reader.GetString(reader.GetOrdinal("roomCode")),
            roomName = reader.GetString(reader.GetOrdinal("roomName")),
            bookingDate = reader.GetDateTime(reader.GetOrdinal("bookingDate")),
            slot = reader.GetString(reader.GetOrdinal("slot")),
            purpose = ReadNullableString(reader, "purpose"),
            status = reader.GetString(reader.GetOrdinal("status")),
            createdAt = reader.GetDateTime(reader.GetOrdinal("createdAt"))
        });
    }
    catch (SqlException ex) when (ex.Number == 50000)
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

app.MapPost("/api/room-bookings/{bookingNo}/actions", async (
    HttpContext httpContext,
    IConfiguration config,
    string bookingNo,
    RoomBookingActionRequest body,
    CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(detail: "Missing MSSQL connection string.", statusCode: StatusCodes.Status500InternalServerError);
    }

    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null)
    {
        return Results.Unauthorized();
    }

    if (authUser.Role != "admin" && authUser.Role != "approver")
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    if (string.IsNullOrWhiteSpace(bookingNo) || string.IsNullOrWhiteSpace(body.Action))
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var command = new SqlCommand("dbo.sp_RoomBookings_ApplyAction", connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 20
        };

        command.Parameters.Add(new SqlParameter("@BookingNo", SqlDbType.NVarChar, 30) { Value = bookingNo.Trim() });
        command.Parameters.Add(new SqlParameter("@Action", SqlDbType.NVarChar, 20) { Value = body.Action.Trim() });
        command.Parameters.Add(new SqlParameter("@ActorUsername", SqlDbType.NVarChar, 50) { Value = authUser.Username });
        command.Parameters.Add(new SqlParameter("@Note", SqlDbType.NVarChar, -1) { Value = string.IsNullOrWhiteSpace(body.Note) ? DBNull.Value : body.Note.Trim() });

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return Results.Problem(detail: "room_booking_action_failed", statusCode: StatusCodes.Status502BadGateway);
        }

        return Results.Ok(new
        {
            id = reader.GetInt32(reader.GetOrdinal("id")),
            bookingNo = reader.GetString(reader.GetOrdinal("bookingNo")),
            requesterUsername = reader.GetString(reader.GetOrdinal("requesterUsername")),
            requesterFullName = ReadNullableString(reader, "requesterFullName"),
            roomCode = reader.GetString(reader.GetOrdinal("roomCode")),
            roomName = reader.GetString(reader.GetOrdinal("roomName")),
            bookingDate = reader.GetDateTime(reader.GetOrdinal("bookingDate")),
            slot = reader.GetString(reader.GetOrdinal("slot")),
            purpose = ReadNullableString(reader, "purpose"),
            status = reader.GetString(reader.GetOrdinal("status")),
            handledBy = ReadNullableString(reader, "handledBy"),
            handledNote = ReadNullableString(reader, "handledNote"),
            createdAt = reader.GetDateTime(reader.GetOrdinal("createdAt")),
            updatedAt = reader.GetDateTime(reader.GetOrdinal("updatedAt"))
        });
    }
    catch (SqlException ex) when (ex.Number == 50000)
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



// --- API User Registration & Profile ---
app.MapPost("/api/users/register", async (HttpContext httpContext, IConfiguration config, RegisterRequest body, CancellationToken ct) =>
{
    var connectionString = GetMssqlConnectionString(config);
    if (string.IsNullOrWhiteSpace(connectionString)) return Results.Problem("Missing DB config");
    if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.Password) || string.IsNullOrWhiteSpace(body.FullName))
        return Results.BadRequest(new { error = "invalid_payload" });

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("dbo.sp_Users_Register", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = body.Username.Trim() });
        command.Parameters.Add(new SqlParameter("@PasswordHash", SqlDbType.NVarChar, 255) { Value = ComputeSha256Hex(body.Password.Trim()) });
        command.Parameters.Add(new SqlParameter("@FullName", SqlDbType.NVarChar, 150) { Value = body.FullName.Trim() });
        command.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar, 255) { Value = string.IsNullOrWhiteSpace(body.Email) ? DBNull.Value : body.Email.Trim() });
        command.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar, 30) { Value = string.IsNullOrWhiteSpace(body.Phone) ? DBNull.Value : body.Phone.Trim() });
        
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return Results.Problem("registration_failed");
        return Results.Ok(new {
            username = reader.GetString(reader.GetOrdinal("username")),
            fullName = ReadNullableString(reader, "fullName"),
            role = reader.GetString(reader.GetOrdinal("role")),
            status = reader.GetString(reader.GetOrdinal("status"))
        });
    }
    catch (SqlException ex) when (ex.Number == 50000) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/users/{username}/profile", async (HttpContext httpContext, IConfiguration config, string username, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || (authUser.Username != username && authUser.Role != "admin")) return Results.Unauthorized();
    
    var connectionString = GetMssqlConnectionString(config);
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(ct);
    await using var command = new SqlCommand("SELECT username, full_name, email, phone FROM dbo.users WHERE username = @Username", connection);
    command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = username });
    await using var reader = await command.ExecuteReaderAsync(ct);
    if (!await reader.ReadAsync(ct)) return Results.NotFound();
    
    return Results.Ok(new {
        username = reader.GetString(0),
        fullName = ReadNullableString(reader, "full_name"),
        email = ReadNullableString(reader, "email"),
        phone = ReadNullableString(reader, "phone")
    });
});

app.MapPut("/api/users/{username}/profile", async (HttpContext httpContext, IConfiguration config, string username, UpdateProfileRequest body, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || (authUser.Username != username && authUser.Role != "admin")) return Results.Unauthorized();
    
    var connectionString = GetMssqlConnectionString(config);
    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("dbo.sp_Users_UpdateProfile", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = username });
        command.Parameters.Add(new SqlParameter("@FullName", SqlDbType.NVarChar, 150) { Value = body.FullName.Trim() });
        command.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar, 255) { Value = string.IsNullOrWhiteSpace(body.Email) ? DBNull.Value : body.Email.Trim() });
        command.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar, 30) { Value = string.IsNullOrWhiteSpace(body.Phone) ? DBNull.Value : body.Phone.Trim() });
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return Results.Problem("update_failed");
        return Results.Ok(new { success = true });
    }
    catch (SqlException ex) when (ex.Number == 50000) { return Results.BadRequest(new { error = ex.Message }); }
});

// --- API Admin CRUD ---
app.MapGet("/api/admin/users", async (HttpContext httpContext, IConfiguration config, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || authUser.Role != "admin") return Results.Unauthorized();
    var connectionString = GetMssqlConnectionString(config);
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(ct);
    await using var command = new SqlCommand("dbo.sp_Admin_Users_List", connection) { CommandType = CommandType.StoredProcedure };
    await using var reader = await command.ExecuteReaderAsync(ct);
    var users = new List<object>();
    while (await reader.ReadAsync(ct))
    {
        users.Add(new {
            username = reader.GetString(reader.GetOrdinal("username")),
            fullName = ReadNullableString(reader, "fullName"),
            email = ReadNullableString(reader, "email"),
            phone = ReadNullableString(reader, "phone"),
            role = reader.GetString(reader.GetOrdinal("role")),
            status = reader.GetString(reader.GetOrdinal("status")),
            createdAt = reader.GetDateTime(reader.GetOrdinal("createdAt"))
        });
    }
    return Results.Ok(new { users });
});

app.MapPut("/api/admin/users/{username}", async (HttpContext httpContext, IConfiguration config, string username, AdminUserUpdateRequest body, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || authUser.Role != "admin") return Results.Unauthorized();
    var connectionString = GetMssqlConnectionString(config);
    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("dbo.sp_Admin_Users_Update", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = username });
        command.Parameters.Add(new SqlParameter("@FullName", SqlDbType.NVarChar, 150) { Value = body.FullName.Trim() });
        command.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar, 255) { Value = string.IsNullOrWhiteSpace(body.Email) ? DBNull.Value : body.Email.Trim() });
        command.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar, 30) { Value = string.IsNullOrWhiteSpace(body.Phone) ? DBNull.Value : body.Phone.Trim() });
        command.Parameters.Add(new SqlParameter("@Role", SqlDbType.NVarChar, 20) { Value = body.Role.Trim() });
        command.Parameters.Add(new SqlParameter("@Status", SqlDbType.NVarChar, 20) { Value = body.Status.Trim() });
        await command.ExecuteNonQueryAsync(ct);
        return Results.Ok(new { success = true });
    }
    catch (SqlException ex) when (ex.Number == 50000) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapDelete("/api/admin/users/{username}", async (HttpContext httpContext, IConfiguration config, string username, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || authUser.Role != "admin") return Results.Unauthorized();
    var connectionString = GetMssqlConnectionString(config);
    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("dbo.sp_Admin_Users_Delete", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@Username", SqlDbType.NVarChar, 50) { Value = username });
        await command.ExecuteNonQueryAsync(ct);
        return Results.Ok(new { success = true });
    }
    catch (SqlException ex) when (ex.Number == 50000) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/admin/borrow-requests", async (HttpContext httpContext, IConfiguration config, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || authUser.Role != "admin") return Results.Unauthorized();
    var connectionString = GetMssqlConnectionString(config);
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(ct);
    await using var command = new SqlCommand("dbo.sp_Admin_BorrowRequests_List", connection) { CommandType = CommandType.StoredProcedure };
    await using var reader = await command.ExecuteReaderAsync(ct);
    var requests = new List<object>();
    while (await reader.ReadAsync(ct))
    {
        requests.Add(new {
            id = reader.GetInt32(reader.GetOrdinal("id")),
            requestNo = reader.GetString(reader.GetOrdinal("requestNo")),
            requesterUsername = reader.GetString(reader.GetOrdinal("requesterUsername")),
            requesterFullName = ReadNullableString(reader, "requesterFullName"),
            deviceCode = reader.GetString(reader.GetOrdinal("deviceCode")),
            status = reader.GetString(reader.GetOrdinal("status")),
            createdAt = reader.GetDateTime(reader.GetOrdinal("createdAt")),
            device = new {
                name = ReadNullableString(reader, "deviceName"),
                imageUrl = ReadNullableString(reader, "deviceImageUrl"),
                quantity = reader.GetInt32(reader.GetOrdinal("quantity"))
            }
        });
    }
    return Results.Ok(new { requests });
});

app.MapGet("/api/admin/room-bookings", async (HttpContext httpContext, IConfiguration config, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || authUser.Role != "admin") return Results.Unauthorized();
    var connectionString = GetMssqlConnectionString(config);
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(ct);
    await using var command = new SqlCommand("dbo.sp_Admin_RoomBookings_List", connection) { CommandType = CommandType.StoredProcedure };
    await using var reader = await command.ExecuteReaderAsync(ct);
    var bookings = new List<object>();
    while (await reader.ReadAsync(ct))
    {
        bookings.Add(new {
            bookingNo = reader.GetString(reader.GetOrdinal("bookingNo")),
            requesterUsername = reader.GetString(reader.GetOrdinal("requesterUsername")),
            requesterFullName = ReadNullableString(reader, "requesterFullName"),
            roomCode = reader.GetString(reader.GetOrdinal("roomCode")),
            roomName = ReadNullableString(reader, "roomName"),
            bookingDate = reader.GetDateTime(reader.GetOrdinal("bookingDate")),
            slot = reader.GetString(reader.GetOrdinal("slot")),
            status = reader.GetString(reader.GetOrdinal("status"))
        });
    }
    return Results.Ok(new { bookings });
});

app.MapPut("/api/admin/borrow-requests/{id}/status", async (HttpContext httpContext, IConfiguration config, int id, AdminStatusUpdateRequest body, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || authUser.Role != "admin") return Results.Unauthorized();
    var connectionString = GetMssqlConnectionString(config);
    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("dbo.sp_Admin_UpdateBorrowStatus", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@Id", SqlDbType.Int) { Value = id });
        command.Parameters.Add(new SqlParameter("@Status", SqlDbType.NVarChar, 20) { Value = body.Status.Trim() });
        command.Parameters.Add(new SqlParameter("@HandledBy", SqlDbType.NVarChar, 50) { Value = authUser.Username });
        command.Parameters.Add(new SqlParameter("@HandledNote", SqlDbType.NVarChar, -1) { Value = string.IsNullOrWhiteSpace(body.HandledNote) ? DBNull.Value : body.HandledNote.Trim() });
        await command.ExecuteNonQueryAsync(ct);
        return Results.Ok(new { success = true });
    }
    catch (SqlException ex) when (ex.Number == 50000) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPut("/api/admin/room-bookings/{id}/status", async (HttpContext httpContext, IConfiguration config, int id, AdminStatusUpdateRequest body, CancellationToken ct) =>
{
    var authUser = ReadAuthUser(httpContext, config);
    if (authUser is null || authUser.Role != "admin") return Results.Unauthorized();
    var connectionString = GetMssqlConnectionString(config);
    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("dbo.sp_Admin_UpdateRoomStatus", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@Id", SqlDbType.Int) { Value = id });
        command.Parameters.Add(new SqlParameter("@Status", SqlDbType.NVarChar, 20) { Value = body.Status.Trim() });
        command.Parameters.Add(new SqlParameter("@HandledBy", SqlDbType.NVarChar, 50) { Value = authUser.Username });
        command.Parameters.Add(new SqlParameter("@HandledNote", SqlDbType.NVarChar, -1) { Value = string.IsNullOrWhiteSpace(body.HandledNote) ? DBNull.Value : body.HandledNote.Trim() });
        await command.ExecuteNonQueryAsync(ct);
        return Results.Ok(new { success = true });
    }
    catch (SqlException ex) when (ex.Number == 50000) { return Results.BadRequest(new { error = ex.Message }); }
});

app.Run();

record LookupOption(string value, string label);
record LoginRequest(string Username, string Password, bool Remember);
record AuthUser(string Username, string Role, DateTimeOffset ExpiresAtUtc);
record LoginFailureResult(bool IsLocked, int RetryAfterSeconds, int CurrentFailedCount);
record ClearLockoutRequest(string? Username, bool ClearAll);

// --- New Records for Users/Admin ---
record RegisterRequest(string Username, string Password, string FullName, string? Email, string? Phone);
record UpdateProfileRequest(string FullName, string? Email, string? Phone);
record AdminUserUpdateRequest(string FullName, string? Email, string? Phone, string Role, string Status);
record AdminStatusUpdateRequest(string Status, string? HandledNote);

sealed class LoginThrottleState
{
    public int FailedCount { get; set; }
    public DateTimeOffset? LockedUntilUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

static class LoginThrottleStore
{
    public static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(20);
    public static readonly TimeSpan StateTtl = TimeSpan.FromHours(24);
    public static readonly ConcurrentDictionary<string, LoginThrottleState> StateByUser = new(StringComparer.OrdinalIgnoreCase);
}

record BorrowRequestCreateRequest(string RequesterUsername, string DeviceCode, int Quantity, DateTime NeedDate, string? Note);
record BorrowRequestActionRequest(string Action, string? ActorUsername, string? Note);
record FavoriteRequest(string Username, string DeviceCode);

record RoomBookingCreateRequest(string RoomCode, DateTime BookingDate, string Slot, string? Purpose);
record RoomBookingActionRequest(string Action, string? Note);
