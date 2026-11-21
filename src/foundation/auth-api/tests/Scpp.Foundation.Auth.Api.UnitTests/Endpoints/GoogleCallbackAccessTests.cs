using System.Net;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class GoogleCallbackAccessTests
{
    private const string Denied = "https://frontend.example.org/inloggen/geen-toegang";

    [TestMethod]
    [DataRow("someone@gmail.com", null)]
    [DataRow("someone@scpp.nl", null)]
    [DataRow("someone@scpp.nl", "example.org")]
    [DataRow("someone@example.org", "scpp.nl")]
    [DataRow("someone@evilscpp.nl", "scpp.nl")]
    [DataRow("someone@x.scpp.nl", "scpp.nl")]
    [DataRow("someone@scpp.nl.evil.example", "scpp.nl")]
    [DataRow("someone@scpp.nl", "evilscpp.nl")]
    [DataRow("someone@scpp.nl", "x.scpp.nl")]
    public async Task AccountsOutsideTheWorkspaceGoToTheNoAccessPageWithoutTheEmail(string email, string? hostedDomain)
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync(new IdTokenClaims { Email = email, HostedDomain = hostedDomain });

        Assert.AreEqual(HttpStatusCode.Redirect, response.StatusCode);
        Assert.AreEqual(Denied, response.Headers.Location!.AbsoluteUri);
        Assert.IsNull(ResponseCookies.Value(response, AuthCookies.Session));
        Assert.IsTrue(ResponseCookies.IsDeleted(response, AuthCookies.Flow));
    }

    [TestMethod]
    public async Task UnverifiedEmailGoesToTheNoAccessPage()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync(new IdTokenClaims { EmailVerified = false });

        Assert.AreEqual(Denied, response.Headers.Location!.AbsoluteUri);
        Assert.IsNull(ResponseCookies.Value(response, AuthCookies.Session));
    }

    [TestMethod]
    public async Task EmailNotOnTheAllowListGoesToTheNoAccessPage()
    {
        await using var host = await AuthTestHost.StartAsync(builder =>
            builder.Configuration["Auth:AllowedEmails:0"] = "beheer@scpp.nl");

        using var rejected = await host.SignInAsync(new IdTokenClaims { Email = "member@scpp.nl" });
        using var accepted = await host.SignInAsync(new IdTokenClaims { Email = "Beheer@scpp.nl" });

        Assert.AreEqual(Denied, rejected.Headers.Location!.AbsoluteUri);
        Assert.IsNull(ResponseCookies.Value(rejected, AuthCookies.Session));
        Assert.AreEqual("https://frontend.example.org/beheer", accepted.Headers.Location!.AbsoluteUri);
    }

    [TestMethod]
    public async Task AFailedSignInClearsAnEarlierSession()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync(new IdTokenClaims { HostedDomain = null });

        Assert.IsTrue(ResponseCookies.IsDeleted(response, AuthCookies.Session));
    }
}
