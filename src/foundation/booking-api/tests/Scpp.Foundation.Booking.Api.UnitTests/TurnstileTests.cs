using System.Net;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Foundation.Booking.Api.Configuration;
using Scpp.Foundation.Booking.Api.Endpoints;
using Scpp.Foundation.Booking.Api.Validation;
using Scpp.Foundation.Booking.Api.Verification;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.UnitTests;

[TestClass]
public sealed class TurnstileTests
{
    [TestMethod]
    [DataRow("{\"success\":true,\"hostname\":\"blokhutdewildert.nl\",\"action\":\"booking\"}", 204)]
    [DataRow("{\"success\":false,\"error-codes\":[\"timeout-or-duplicate\"]}", 403)]
    [DataRow("{\"success\":true,\"hostname\":\"blokhutdewildert.nl\",\"action\":\"contact\"}", 403)]
    [DataRow("{\"success\":true,\"hostname\":\"other.blokhutdewildert.nl\",\"action\":\"booking\"}", 403)]
    [DataRow("{\"success\":true,\"hostname\":\"blokhutdewildert.nl\"}", 403)]
    [DataRow("{\"success\":true,\"action\":\"booking\"}", 403)]
    [DataRow("{}", 503)]
    [DataRow("null", 503)]
    [DataRow("not-json", 503)]
    public async Task EndpointRequiresSuccessfulBookingVerification(string response, int status)
    {
        using var stub = new SiteverifyStub { Response = response };
        using var client = new HttpClient(stub);
        var result = await Post("fresh+token", client);
        if (status == 204) Assert.IsInstanceOfType<NoContent>(result.Result);
        else Assert.AreEqual(status, ((ProblemHttpResult)result.Result).StatusCode);
        Assert.AreEqual("https://challenges.cloudflare.com/turnstile/v0/siteverify", stub.Url);
        Assert.AreEqual("secret=test-secret&response=fresh%2Btoken", stub.Body);
    }

    [TestMethod]
    public async Task MissingBlankAndOversizedTokensNeverContactCloudflare()
    {
        foreach (var token in new[] { null, "", " ", new string('x', 2049) })
        {
            using var stub = new SiteverifyStub();
            using var client = new HttpClient(stub);
            var result = await Post(token, client);
            Assert.IsInstanceOfType<ValidationProblem>(result.Result);
            Assert.IsTrue(((ValidationProblem)result.Result).ProblemDetails.Errors.ContainsKey("turnstileToken"));
            Assert.AreEqual(0, stub.Calls);
        }
        using var boundaryClient = new HttpClient(new SiteverifyStub());
        Assert.IsInstanceOfType<NoContent>((await Post(new string('x', 2048), boundaryClient)).Result);
    }

    [TestMethod]
    public async Task UpstreamErrorsAndTimeoutsFailClosed()
    {
        using var httpFailure = new HttpClient(new SiteverifyStub { Status = HttpStatusCode.InternalServerError });
        Assert.AreEqual(503, ((ProblemHttpResult)(await Post("token", httpFailure)).Result).StatusCode);
        foreach (var network in new[] { true, false })
        {
            using var stub = new SiteverifyStub { Respond = async token => {
                if (network) throw new HttpRequestException("network");
                await Task.Delay(Timeout.Infinite, token);
                return new(HttpStatusCode.OK);
            } };
            using var client = new HttpClient(stub) { Timeout = TimeSpan.FromMilliseconds(25) };
            Assert.AreEqual(503, ((ProblemHttpResult)(await Post("token", client)).Result).StatusCode);
        }
    }

    [TestMethod]
    public async Task RequestCancellationPropagates()
    {
        using var stub = new SiteverifyStub { Respond = async token => {
            await Task.Delay(Timeout.Infinite, token);
            return new(HttpStatusCode.OK);
        } };
        using var client = new HttpClient(stub);
        using var cancellation = new CancellationTokenSource(25);
        var verifier = new TurnstileVerifier(client, new("test-secret", ["blokhutdewildert.nl"]));
        await Assert.ThrowsAsync<OperationCanceledException>(() => verifier.Verify("token", cancellation.Token));
    }

    [TestMethod]
    public void ConfigurationRejectsMissingAndUnsafeProductionSettings()
    {
        foreach (var (secret, host) in new[] {
            ("", "blokhutdewildert.nl"), ("test-secret", ""), ("test-secret", "localhost"),
            ("test-secret", "127.0.0.1"), ("test-secret", "::1"), ("test-secret", "*.blokhutdewildert.nl"),
            ("test-secret", "https://blokhutdewildert.nl"),
            ("1x0000000000000000000000000000000AA", "blokhutdewildert.nl"),
            ("2x0000000000000000000000000000000AA", "blokhutdewildert.nl"),
            ("3x0000000000000000000000000000000AA", "blokhutdewildert.nl")
        })
            Assert.Throws<InvalidOperationException>(() => Load(secret, host, "Production"));
        Assert.Throws<InvalidOperationException>(() => TurnstileSettings.Load(
            new ConfigurationBuilder().Build(), new TestHostEnvironment("Production")));
        Assert.HasCount(1, Load("test-secret", "blokhutdewildert.nl", "Production").AllowedHostnames);
        Assert.HasCount(1, Load("test-secret", "localhost", "Development").AllowedHostnames);
    }

    private static TurnstileSettings Load(string secret, string host, string environment) => TurnstileSettings.Load(
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["BOOKING_TURNSTILE_SECRET_KEY"] = secret, ["Turnstile:AllowedHostnames:0"] = host
        }).Build(), new TestHostEnvironment(environment));

    private static Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> Post(string? token, HttpClient client) =>
        BookingEndpoint.Post(new BookingRequestDto {
            Name = "Renter", Email = "renter@example.org", Building = "groot", GroupType = "family",
            Date = new DateOnly(2099, 6, 4), Dayparts = ["ochtend"], Guests = 20, TurnstileToken = token
        }, new BookingRequestValidator(TimeProvider.System), NullLogger<BookingEndpoint>.Instance,
        new TurnstileVerifier(client, new("test-secret", ["blokhutdewildert.nl"])), CancellationToken.None);
}
