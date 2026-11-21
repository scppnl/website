using System.Net;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class GoogleCallbackSuccessTests
{
    [TestMethod]
    [DataRow("member@scpp.nl", "scpp.nl")]
    [DataRow("Member@Scpp.NL", "scpp.nl")]
    [DataRow("beheer@blokhutdewildert.nl", "scpp.nl")]
    [DataRow("beheer@blokhutdewildert.nl", "blokhutdewildert.nl")]
    public async Task AllowedWorkspaceAccountIsRedirectedToThePostSignInPage(string email, string hostedDomain)
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync(new IdTokenClaims { Email = email, HostedDomain = hostedDomain });

        Assert.AreEqual(HttpStatusCode.Redirect, response.StatusCode);
        Assert.AreEqual("https://frontend.example.org/beheer", response.Headers.Location!.AbsoluteUri);
        Assert.IsNotNull(ResponseCookies.Value(response, AuthCookies.Session));
    }

    [TestMethod]
    public async Task SessionCookieIsHostOnlySecureHttpOnlyLaxAndEightHoursLong()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync();

        var header = ResponseCookies.Header(response, AuthCookies.Session)!.ToLowerInvariant();
        Assert.Contains("; secure", header);
        Assert.Contains("; httponly", header);
        Assert.Contains("; samesite=lax", header);
        Assert.Contains("; path=/", header);
        Assert.DoesNotContain("domain=", header);
        Assert.Contains("expires=sat, 21 nov 2026 20:00:00 gmt", header);
    }

    [TestMethod]
    public async Task FlowCookieIsClearedAndResponseIsNotCacheableOrReferred()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync();

        Assert.IsTrue(ResponseCookies.IsDeleted(response, AuthCookies.Flow));
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        Assert.AreEqual("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
    }

    [TestMethod]
    public async Task CodeExchangeCarriesTheSecretRedirectUriAndVerifier()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync();

        Assert.IsTrue(host.Google.TokenRequests.TryPeek(out var request));
        Assert.AreEqual(AuthTestHost.AuthorizationCode, request["code"]);
        Assert.AreEqual("authorization_code", request["grant_type"]);
        Assert.AreEqual(AuthTestHost.ClientId, request["client_id"]);
        Assert.AreEqual(AuthTestHost.ClientSecret, request["client_secret"]);
        Assert.AreEqual("https://auth.example.org/auth/google/callback", request["redirect_uri"]);
        Assert.HasCount(43, request["code_verifier"]);
    }

    [TestMethod]
    public async Task IdTokenWithMatchingAuthorizedPartyIsAccepted()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync(new IdTokenClaims { AuthorizedParty = AuthTestHost.ClientId });

        Assert.AreEqual("https://frontend.example.org/beheer", response.Headers.Location!.AbsoluteUri);
    }

    [TestMethod]
    public async Task IssuerWithoutSchemeIsAccepted()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync(new IdTokenClaims { Issuer = "accounts.google.com" });

        Assert.AreEqual("https://frontend.example.org/beheer", response.Headers.Location!.AbsoluteUri);
    }
}
