using System.Net;
using System.Text.Json;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class SessionTests
{
    [TestMethod]
    public async Task SignedInUserGetsTheirEmailAndExpiry()
    {
        await using var host = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(host);

        using var response = await host.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual("member@scpp.nl", body.RootElement.GetProperty("email").GetString());
        Assert.AreEqual("Jan Jansen", body.RootElement.GetProperty("name").GetString());
        Assert.AreEqual(DateTimeOffset.Parse("2026-11-21T20:00:00Z"), body.RootElement.GetProperty("expiresAt").GetDateTimeOffset());
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("  ")]
    public async Task SessionWithoutANameStillWorks(string? name)
    {
        await using var host = await AuthTestHost.StartAsync();
        using var signIn = await host.SignInAsync(new IdTokenClaims { Name = name });
        var cookie = $"{AuthCookies.Session}={ResponseCookies.Value(signIn, AuthCookies.Session)}";

        using var response = await host.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual("member@scpp.nl", body.RootElement.GetProperty("email").GetString());
        Assert.AreEqual(JsonValueKind.Null, body.RootElement.GetProperty("name").ValueKind);
    }

    [TestMethod]
    public async Task SessionFromAnOlderVersionIsUnauthorized()
    {
        await using var host = await AuthTestHost.StartAsync();
        var payload = new SessionPayload
        {
            Version = 1,
            Subject = "1234567890",
            Email = "member@scpp.nl",
            HostedDomain = "scpp.nl",
            IssuedAt = host.Clock.GetUtcNow().ToUnixTimeSeconds(),
            ExpiresAt = host.Clock.GetUtcNow().AddHours(8).ToUnixTimeSeconds(),
        };
        var cookie = $"{AuthCookies.Session}={host.Protect(AuthCookies.Session, payload)}";

        using var response = await host.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task NoCookieIsUnauthorized()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.GetAsync("/auth/session");

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task ExpiredSessionIsUnauthorized()
    {
        await using var host = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(host);
        host.Clock.Advance(TimeSpan.FromHours(8));

        using var response = await host.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task SessionIsStillValidJustBeforeItExpires()
    {
        await using var host = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(host);
        host.Clock.Advance(TimeSpan.FromHours(8) - TimeSpan.FromSeconds(1));

        using var response = await host.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [TestMethod]
    public async Task TamperedSessionIsUnauthorized()
    {
        await using var host = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(host);
        var tampered = cookie[..^1] + (cookie[^1] == 'A' ? 'B' : 'A');

        using var response = await host.GetAsync("/auth/session", tampered);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task FlowCookieCannotBeUsedAsASession()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();
        var value = attempt.FlowCookie[(AuthCookies.Flow.Length + 1)..];

        using var response = await host.GetAsync("/auth/session", $"{AuthCookies.Session}={value}");

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task SessionFromAnotherKeyRingIsUnauthorized()
    {
        await using var other = await AuthTestHost.StartAsync(builder =>
            builder.Configuration["AUTH_SESSION_KEYS"] = "{\"activeKeyId\":\"other\",\"keys\":{\"other\":\"" +
                Convert.ToBase64String(new byte[32].Select((_, i) => (byte)(200 + i)).ToArray()) + "\"}}");
        var cookie = await SignedInCookieAsync(other);
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task SessionSurvivesKeyRotationWhileTheOldKeyIsListed()
    {
        await using var old = await AuthTestHost.StartAsync(builder =>
            builder.Configuration["AUTH_SESSION_KEYS"] = "{\"activeKeyId\":\"k1\",\"keys\":{" +
                "\"k1\":\"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=\"}}");
        var cookie = await SignedInCookieAsync(old);
        await using var rotated = await AuthTestHost.StartAsync();

        using var response = await rotated.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [TestMethod]
    public async Task RemovingTheEmailFromTheAllowListEndsAnExistingSession()
    {
        await using var open = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(open);
        await using var restricted = await AuthTestHost.StartAsync(builder =>
            builder.Configuration["Auth:AllowedEmails:0"] = "someone.else@scpp.nl");

        using var response = await restricted.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task AllowedFrontendOriginMayReadTheSessionWithCredentials()
    {
        await using var host = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(host);

        using var response = await host.GetAsync("/auth/session", cookie, origin: AuthTestHost.FrontendOrigin);

        Assert.AreEqual(AuthTestHost.FrontendOrigin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.AreEqual("true", response.Headers.GetValues("Access-Control-Allow-Credentials").Single());
    }

    [TestMethod]
    [DataRow("https://evil.example")]
    [DataRow("https://scpp-foundation.de-wildert-penp.workers.dev")]
    public async Task OtherOriginsGetNoCorsHeaders(string origin)
    {
        await using var host = await AuthTestHost.StartAsync();
        var cookie = await SignedInCookieAsync(host);

        using var response = await host.GetAsync("/auth/session", cookie, origin: origin);

        Assert.IsFalse(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.IsFalse(response.Headers.Contains("Access-Control-Allow-Credentials"));
    }

    private static async Task<string> SignedInCookieAsync(AuthTestHost host)
    {
        using var response = await host.SignInAsync();
        return $"{AuthCookies.Session}={ResponseCookies.Value(response, AuthCookies.Session)}";
    }
}
