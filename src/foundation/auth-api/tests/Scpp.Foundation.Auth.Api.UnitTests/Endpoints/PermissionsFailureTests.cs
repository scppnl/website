using System.Net;
using Serilog.Events;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class PermissionsFailureTests
{
    [TestMethod]
    [DataRow(HttpStatusCode.Forbidden)]
    [DataRow(HttpStatusCode.TooManyRequests)]
    [DataRow(HttpStatusCode.InternalServerError)]
    public async Task GroupsLookupRejectedAtSignInRefusesTheSignIn(HttpStatusCode status)
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        host.Google.GroupsStatus = status;

        using var response = await host.SignInAsync();

        AssertSignInUnavailable(response);
    }

    [TestMethod]
    public async Task NetworkFailureOfTheGroupsLookupRefusesTheSignIn()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        host.Google.GroupsFailure = new HttpRequestException("connection refused");

        using var response = await host.SignInAsync();

        AssertSignInUnavailable(response);
    }

    [TestMethod]
    public async Task MissingMetadataTokenRefusesTheSignIn()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        host.Google.MetadataStatus = HttpStatusCode.InternalServerError;

        using var response = await host.SignInAsync();

        AssertSignInUnavailable(response);
        Assert.IsEmpty(host.Google.GroupRequests);
    }

    [TestMethod]
    public async Task MoreGroupsThanTheSafetyLimitFailClosed()
    {
        var tooMany = Enumerable.Range(0, 11).Select(index => $"group{index}@scpp.nl").ToArray();
        await using var host = await PermissionHost.StartAsync(tooMany);
        host.Google.GroupsPageSize = 1;

        using var response = await host.SignInAsync();

        AssertSignInUnavailable(response);
    }

    [TestMethod]
    public async Task FailedRefreshIsReportedAsUnavailableAndNotRemembered()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        var cookie = await PermissionHost.SignInAsync(host);
        host.Clock.Advance(TimeSpan.FromMinutes(10));
        host.Google.GroupsStatus = HttpStatusCode.InternalServerError;

        using var failed = await host.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        Assert.AreEqual("text/plain", failed.Content.Headers.ContentType!.MediaType);
        host.Google.GroupsStatus = HttpStatusCode.OK;
        CollectionAssert.AreEqual(new[] { "bookings.manage", "contact.read" }, await PermissionHost.PermissionsAsync(host, cookie));
        Assert.HasCount(3, host.Google.GroupRequests);
    }

    [TestMethod]
    public async Task LookupsNeverLogEmailsGroupsTokensOrQueries()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        var cookie = await PermissionHost.SignInAsync(host, "private.person@scpp.nl");
        await PermissionHost.PermissionsAsync(host, cookie);
        host.Clock.Advance(TimeSpan.FromMinutes(10));
        host.Google.GroupsStatus = HttpStatusCode.InternalServerError;
        using var failed = await host.GetAsync("/auth/session", cookie);

        var warning = host.Sink.Events.Single(logEvent => logEvent.MessageTemplate.Text == "Session permissions lookup failed with {FailureCategory}");
        Assert.AreEqual(LogEventLevel.Warning, warning.Level);
        var everything = string.Join('\n', host.Sink.Events.Select(Describe));
        foreach (var secret in new[] { "private.person@scpp.nl", PermissionHost.BookingsGroup, "test-access-token", "member_key_id", "bookings.manage" }) {
            Assert.DoesNotContain(secret, everything);
        }
    }

    private static void AssertSignInUnavailable(HttpResponseMessage response)
    {
        Assert.AreEqual(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.IsNull(response.Headers.Location);
        Assert.IsNull(ResponseCookies.Value(response, AuthCookies.Session));
        Assert.IsTrue(ResponseCookies.IsDeleted(response, AuthCookies.Flow));
    }

    private static string Describe(LogEvent logEvent) =>
        logEvent.RenderMessage() + " " + string.Join(' ', logEvent.Properties.Select(pair => $"{pair.Key}={pair.Value}")) + " " + logEvent.Exception;
}
