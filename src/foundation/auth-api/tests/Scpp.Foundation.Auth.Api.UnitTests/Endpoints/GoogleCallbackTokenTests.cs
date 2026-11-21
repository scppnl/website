using System.Net;
using Microsoft.IdentityModel.Tokens;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class GoogleCallbackTokenTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 21, 12, 0, 0, TimeSpan.Zero);

    public static IEnumerable<object[]> InvalidTokens =>
    [
        [new IdTokenClaims { Nonce = "another-nonce" }],
        [new IdTokenClaims { ExpiresAt = Now.AddMinutes(-5), IssuedAt = Now.AddHours(-1) }],
        [new IdTokenClaims { IssuedAt = Now.AddMinutes(5), ExpiresAt = Now.AddHours(1) }],
        [new IdTokenClaims { SigningKey = TestSigningKey.Forged }],
        [new IdTokenClaims { SigningKey = TestSigningKey.Unpublished }],
        [new IdTokenClaims { Issuer = "https://evil.example" }],
        [new IdTokenClaims { Audience = "another-client.apps.googleusercontent.com" }],
        [new IdTokenClaims { AuthorizedParty = "another-client.apps.googleusercontent.com" }],
        [new IdTokenClaims { Algorithm = SecurityAlgorithms.RsaSha384 }],
    ];

    [TestMethod]
    [DynamicData(nameof(InvalidTokens))]
    public async Task InvalidIdTokenGoesBackToTheSignInPageWithoutASession(IdTokenClaims claims)
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync(claims);

        Assert.AreEqual(HttpStatusCode.Redirect, response.StatusCode);
        Assert.AreEqual("https://frontend.example.org/inloggen", response.Headers.Location!.AbsoluteUri);
        Assert.IsNull(ResponseCookies.Value(response, AuthCookies.Session));
    }

    [TestMethod]
    public async Task TokenThatExpiredWithinTheClockSkewIsStillAccepted()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.SignInAsync(new IdTokenClaims { ExpiresAt = Now.AddSeconds(-30), IssuedAt = Now.AddHours(-1) });

        Assert.AreEqual("https://frontend.example.org/beheer", response.Headers.Location!.AbsoluteUri);
    }

    [TestMethod]
    public async Task UnsignedTokenIsRejected()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();
        host.Google.IdToken = "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIiwiZW1haWwiOiJhQHNjcHAubmwifQ.";

        using var response = await host.GetAsync(
            $"/auth/google/callback?code={AuthTestHost.AuthorizationCode}&state={attempt.State}", attempt.FlowCookie);

        Assert.AreEqual("https://frontend.example.org/inloggen", response.Headers.Location!.AbsoluteUri);
    }

    [TestMethod]
    public async Task NonJwtTokenIsRejected()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();
        host.Google.IdToken = "not-a-jwt";

        using var response = await host.GetAsync(
            $"/auth/google/callback?code={AuthTestHost.AuthorizationCode}&state={attempt.State}", attempt.FlowCookie);

        Assert.AreEqual("https://frontend.example.org/inloggen", response.Headers.Location!.AbsoluteUri);
    }
}
