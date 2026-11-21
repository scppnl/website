using System.Buffers.Text;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class GoogleSignInTests
{
    [TestMethod]
    public async Task RedirectsToGoogleWithPkceStateAndNonce()
    {
        await using var host = await AuthTestHost.StartAsync();

        var attempt = await host.StartSignInAsync();

        Assert.AreEqual("accounts.google.com", attempt.Location.Host);
        Assert.AreEqual("/o/oauth2/v2/auth", attempt.Location.AbsolutePath);
        var query = QueryHelpers.ParseQuery(attempt.Location.Query);
        Assert.AreEqual("code", query["response_type"].ToString());
        Assert.AreEqual(AuthTestHost.ClientId, query["client_id"].ToString());
        Assert.AreEqual("https://auth.example.org/auth/google/callback", query["redirect_uri"].ToString());
        Assert.AreEqual("openid email", query["scope"].ToString());
        Assert.AreEqual("S256", query["code_challenge_method"].ToString());
        Assert.AreEqual("*", query["hd"].ToString());
        Assert.IsFalse(query.ContainsKey("prompt"));
        Assert.HasCount(43, attempt.State);
        Assert.HasCount(43, attempt.Nonce);
        Assert.AreNotEqual(attempt.State, attempt.Nonce);
    }

    [TestMethod]
    public async Task EachAttemptGetsFreshValues()
    {
        await using var host = await AuthTestHost.StartAsync();

        var first = await host.StartSignInAsync();
        var second = await host.StartSignInAsync();

        Assert.AreNotEqual(first.State, second.State);
        Assert.AreNotEqual(first.Nonce, second.Nonce);
        Assert.AreNotEqual(first.Challenge, second.Challenge);
    }

    [TestMethod]
    public async Task FlowCookieIsHostOnlySecureHttpOnlyAndLax()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.GetAsync("/auth/google");

        var header = ResponseCookies.Header(response, AuthCookies.Flow)!.ToLowerInvariant();
        Assert.StartsWith("__host-scpp-auth-flow=", header);
        Assert.Contains("; secure", header);
        Assert.Contains("; httponly", header);
        Assert.Contains("; samesite=lax", header);
        Assert.Contains("; path=/", header);
        Assert.DoesNotContain("domain=", header);
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
    }

    [TestMethod]
    public async Task FlowCookieHoldsNoPlaintext()
    {
        await using var host = await AuthTestHost.StartAsync();

        var attempt = await host.StartSignInAsync();

        Assert.DoesNotContain(attempt.State, attempt.FlowCookie);
        Assert.DoesNotContain(attempt.Nonce, attempt.FlowCookie);
    }

    [TestMethod]
    public async Task SelectAccountPromptIsForwarded()
    {
        await using var host = await AuthTestHost.StartAsync();

        var attempt = await host.StartSignInAsync("?prompt=select_account");

        Assert.AreEqual("select_account", QueryHelpers.ParseQuery(attempt.Location.Query)["prompt"].ToString());
    }

    [TestMethod]
    [DataRow("?prompt=consent")]
    [DataRow("?prompt=none")]
    [DataRow("?prompt=select_account&prompt=consent")]
    [DataRow("?redirect_uri=https://evil.example&state=x&hd=evil.example&login_hint=a@b.c")]
    public async Task OtherQueryValuesAreNeverForwarded(string query)
    {
        await using var host = await AuthTestHost.StartAsync();

        var attempt = await host.StartSignInAsync(query);

        var forwarded = QueryHelpers.ParseQuery(attempt.Location.Query);
        Assert.IsFalse(forwarded.ContainsKey("prompt"));
        Assert.IsFalse(forwarded.ContainsKey("login_hint"));
        Assert.AreEqual("https://auth.example.org/auth/google/callback", forwarded["redirect_uri"].ToString());
        Assert.AreEqual("*", forwarded["hd"].ToString());
        Assert.AreEqual(attempt.State, forwarded["state"].ToString());
    }

    [TestMethod]
    public async Task NonCanonicalHostRedirectsToTheConfiguredApiOrigin()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var plain = await host.GetAsync("/auth/google", host: "auth-api-123.europe-west4.run.app");
        using var picker = await host.GetAsync("/auth/google?prompt=select_account&x=1", host: "auth-api-123.europe-west4.run.app");

        Assert.AreEqual(HttpStatusCode.Redirect, plain.StatusCode);
        Assert.AreEqual("https://auth.example.org/auth/google", plain.Headers.Location!.AbsoluteUri);
        Assert.AreEqual("https://auth.example.org/auth/google?prompt=select_account", picker.Headers.Location!.AbsoluteUri);
        Assert.IsNull(ResponseCookies.Header(plain, AuthCookies.Flow));
    }

    [TestMethod]
    public async Task PkceChallengeIsTheSha256OfTheVerifierSentToGoogle()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();

        using var response = await host.CompleteAsync(attempt);

        Assert.AreEqual(HttpStatusCode.Redirect, response.StatusCode);
        Assert.IsTrue(host.Google.TokenRequests.TryPeek(out var request));
        var expected = Base64Url.EncodeToString(SHA256.HashData(Encoding.ASCII.GetBytes(request["code_verifier"])));
        Assert.AreEqual(expected, attempt.Challenge);
    }
}
