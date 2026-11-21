using System.Net;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class GoogleCallbackProviderTests
{
    [TestMethod]
    [DataRow(HttpStatusCode.BadRequest)]
    [DataRow(HttpStatusCode.Unauthorized)]
    public async Task RejectedCodeGoesBackToTheSignInPage(HttpStatusCode status)
    {
        await using var host = await AuthTestHost.StartAsync();
        host.Google.TokenStatus = status;

        using var response = await host.SignInAsync();

        Assert.AreEqual(HttpStatusCode.Redirect, response.StatusCode);
        Assert.AreEqual("https://frontend.example.org/inloggen", response.Headers.Location!.AbsoluteUri);
        Assert.IsNull(ResponseCookies.Value(response, AuthCookies.Session));
    }

    [TestMethod]
    public async Task ProviderServerErrorIsReportedAsUnavailable()
    {
        await using var host = await AuthTestHost.StartAsync();
        host.Google.TokenStatus = HttpStatusCode.InternalServerError;

        using var response = await host.SignInAsync();

        AssertUnavailable(response);
    }

    [TestMethod]
    [DataRow("not json")]
    [DataRow("{}")]
    [DataRow("{\"id_token\":\"\"}")]
    public async Task MalformedTokenResponseIsReportedAsUnavailable(string body)
    {
        await using var host = await AuthTestHost.StartAsync();
        host.Google.TokenBody = body;

        using var response = await host.SignInAsync();

        AssertUnavailable(response);
    }

    [TestMethod]
    public async Task NetworkFailureIsReportedAsUnavailable()
    {
        await using var host = await AuthTestHost.StartAsync();
        host.Google.TokenFailure = new HttpRequestException("connection refused");

        using var response = await host.SignInAsync();

        AssertUnavailable(response);
    }

    [TestMethod]
    public async Task TimeoutIsReportedAsUnavailable()
    {
        await using var host = await AuthTestHost.StartAsync();
        host.Google.TokenFailure = new TaskCanceledException("timeout", new TimeoutException());

        using var response = await host.SignInAsync();

        AssertUnavailable(response);
    }

    [TestMethod]
    public async Task UnavailableSigningKeysAreReportedAsUnavailable()
    {
        await using var host = await AuthTestHost.StartAsync();
        host.Google.DiscoveryStatus = HttpStatusCode.ServiceUnavailable;

        using var response = await host.SignInAsync();

        AssertUnavailable(response);
    }

    private static void AssertUnavailable(HttpResponseMessage response)
    {
        Assert.AreEqual(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.IsNull(response.Headers.Location);
        Assert.IsNull(ResponseCookies.Value(response, AuthCookies.Session));
        Assert.IsTrue(ResponseCookies.IsDeleted(response, AuthCookies.Flow));
    }
}
