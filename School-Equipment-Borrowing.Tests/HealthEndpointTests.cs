// HealthEndpointTests.cs
// Simple integration test for the health check endpoint.

using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace SchoolEquipmentBorrowing.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        // Create a client that points to the in‑memory test server.
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task HealthEndpoint_ReturnsOk()
    {
        // Act
        var response = await _client.GetAsync("/api/health");

        // Assert
        response.EnsureSuccessStatusCode(); // 200‑OK
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"status\":\"ok\"", json);
    }
}
