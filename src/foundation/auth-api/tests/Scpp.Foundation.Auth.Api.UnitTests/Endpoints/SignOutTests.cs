using System.Net;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class SignOutTests
{
    [TestMethod]
    public async Task FrontendOriginEndsTheSession()
    {
        await using var host = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(host);

        using var response = await host.DeleteAsync("/auth/session", cookie, AuthTestHost.FrontendOrigin);

        Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
        Assert.IsTrue(ResponseCookies.IsDeleted(response, AuthCookies.Session));
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        Assert.AreEqual(AuthTestHost.FrontendOrigin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.AreEqual("true", response.Headers.GetValues("Access-Control-Allow-Credentials").Single());
    }

    [TestMethod]
    public async Task SigningOutWithoutASessionStillSucceeds()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.DeleteAsync("/auth/session", origin: AuthTestHost.FrontendOrigin);

        Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("https://evil.example")]
    [DataRow("https://" + AuthTestHost.ApiHost)]
    public async Task OtherOriginsCannotSignAVisitorOut(string? origin)
    {
        await using var host = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(host);

        using var response = await host.DeleteAsync("/auth/session", cookie, origin);

        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.IsNull(ResponseCookies.Header(response, AuthCookies.Session));
    }

    [TestMethod]
    public async Task FrontendOriginMayPreflightDelete()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.PreflightAsync("/auth/session", AuthTestHost.FrontendOrigin, "DELETE");

        Assert.AreEqual(AuthTestHost.FrontendOrigin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Contains("DELETE", string.Join(',', response.Headers.GetValues("Access-Control-Allow-Methods")));
    }

    [TestMethod]
    public async Task OtherOriginsGetNoPreflightApproval()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.PreflightAsync("/auth/session", "https://evil.example", "DELETE");

        Assert.IsFalse(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    private static async Task<string> SignedInCookieAsync(AuthTestHost host)
    {
        using var response = await host.SignInAsync();
        return $"{AuthCookies.Session}={ResponseCookies.Value(response, AuthCookies.Session)}";
    }
}
