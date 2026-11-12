using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.UnitTests;

[TestClass]
public sealed class BookingApiTests
{
    private const string AllowedOrigin = "https://booking.example.org";
    private WebApplication app = null!;
    private HttpClient client = null!;

    [TestInitialize]
    public async Task Start()
    {
        app = BookingApi.Build(["--urls", "http://127.0.0.1:0", "--environment", "Testing"],
            builder => builder.Configuration["Cors:AllowedOrigins:0"] = AllowedOrigin);
        await app.StartAsync();
        client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
    }

    [TestCleanup]
    public async Task Stop()
    {
        client.Dispose();
        await app.DisposeAsync();
    }

    [TestMethod]
    public async Task RootReturnsBookingApiAsPlainText()
    {
        using var response = await client.GetAsync("/");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.AreEqual("text/plain", response.Content.Headers.ContentType!.MediaType);
        Assert.AreEqual("Booking API", await response.Content.ReadAsStringAsync());
    }

    [TestMethod]
    public async Task ValidBookingReturnsNoContent()
    {
        var request = new BookingRequestDto
        {
            Name = "Test Renter",
            Email = "renter@example.org",
            Building = "groot",
            GroupType = "family",
            Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            Dayparts = ["ochtend"],
            Guests = 10
        };
        using var response = await client.PostAsJsonAsync("/api/bookings", request,
            BookingJsonContext.Default.BookingRequestDto);

        Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
        Assert.AreEqual("", await response.Content.ReadAsStringAsync());
    }

    [TestMethod]
    public async Task InvalidBookingReturnsSerializedFieldErrors()
    {
        using var response = await client.PostAsJsonAsync("/api/bookings", new BookingRequestDto(),
            BookingJsonContext.Default.BookingRequestDto);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.AreEqual("application/problem+json", response.Content.Headers.ContentType!.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual(400, body.RootElement.GetProperty("status").GetInt32());
        CollectionAssert.AreEquivalent(
            new[] { "name", "email", "building", "groupType", "date", "dayparts", "guests" },
            body.RootElement.GetProperty("errors").EnumerateObject().Select(field => field.Name).ToArray());
    }

    [TestMethod]
    [DataRow("{", "application/json", HttpStatusCode.BadRequest)]
    [DataRow("hello", "text/plain", HttpStatusCode.UnsupportedMediaType)]
    public async Task InvalidRequestBodyIsRejected(string body, string contentType, HttpStatusCode status)
    {
        using var response = await client.PostAsync("/api/bookings",
            new StringContent(body, Encoding.UTF8, contentType));

        Assert.AreEqual(status, response.StatusCode);
    }

    [TestMethod]
    [DataRow(AllowedOrigin, true)]
    [DataRow("https://untrusted.example.org", false)]
    public async Task CorsOnlyAllowsConfiguredOrigin(string origin, bool allowed)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/bookings");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        using var response = await client.SendAsync(request);

        Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
        Assert.AreEqual(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.IsFalse(response.Headers.Contains("Access-Control-Allow-Credentials"));
        if (allowed)
        {
            Assert.AreEqual(origin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
            Assert.AreEqual("POST", response.Headers.GetValues("Access-Control-Allow-Methods").Single());
            Assert.AreEqual("Content-Type", response.Headers.GetValues("Access-Control-Allow-Headers").Single());
        }
    }

    [TestMethod]
    public void WildcardCorsOriginIsRejectedDuringBuild()
    {
        var exception = Assert.ThrowsExactly<InvalidOperationException>(() =>
            BookingApi.Build(["--environment", "Testing"],
                builder => builder.Configuration["Cors:AllowedOrigins:0"] = "*"));

        Assert.AreEqual("Cors:AllowedOrigins must contain explicit origins, not '*'.", exception.Message);
    }
}
