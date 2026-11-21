using System.Net;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class GoogleCallbackFlowTests
{
    private const string SignIn = "https://frontend.example.org/inloggen";

    [TestMethod]
    public async Task TamperedStateGoesBackToTheSignInPageWithoutCallingGoogle()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();

        using var response = await host.CompleteAsync(attempt, state: attempt.State + "x");

        AssertSignInPage(response);
        Assert.IsTrue(host.Google.TokenRequests.IsEmpty);
    }

    [TestMethod]
    public async Task MissingFlowCookieGoesBackToTheSignInPage()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();

        using var response = await host.CompleteAsync(attempt, sendFlowCookie: false);

        AssertSignInPage(response);
        Assert.IsTrue(host.Google.TokenRequests.IsEmpty);
    }

    [TestMethod]
    public async Task ModifiedFlowCookieGoesBackToTheSignInPage()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();
        var last = attempt.FlowCookie[^1];
        var tampered = attempt.FlowCookie[..^1] + (last == 'A' ? 'B' : 'A');

        using var response = await host.CompleteAsync(attempt, flowCookie: tampered);

        AssertSignInPage(response);
    }

    [TestMethod]
    public async Task FlowCookieFromAnEarlierAttemptDoesNotMatchTheNewState()
    {
        await using var host = await AuthTestHost.StartAsync();
        var first = await host.StartSignInAsync();
        var second = await host.StartSignInAsync();

        using var response = await host.CompleteAsync(second, flowCookie: first.FlowCookie);

        AssertSignInPage(response);
    }

    [TestMethod]
    public async Task ExpiredFlowCookieGoesBackToTheSignInPage()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();
        host.Clock.Advance(TimeSpan.FromMinutes(10) + TimeSpan.FromSeconds(1));

        using var response = await host.CompleteAsync(attempt);

        AssertSignInPage(response);
    }

    [TestMethod]
    public async Task SessionCookieCannotBeReplayedAsAFlowCookie()
    {
        await using var host = await AuthTestHost.StartAsync();
        using var signedIn = await host.SignInAsync();
        var session = ResponseCookies.Value(signedIn, AuthCookies.Session);
        var attempt = await host.StartSignInAsync();

        using var response = await host.CompleteAsync(attempt, flowCookie: $"{AuthCookies.Flow}={session}");

        AssertSignInPage(response);
    }

    [TestMethod]
    public async Task GoogleErrorSuchAsCancelGoesBackToTheSignInPage()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();

        using var response = await host.GetAsync($"/auth/google/callback?error=access_denied&state={attempt.State}", attempt.FlowCookie);

        AssertSignInPage(response);
        Assert.IsTrue(ResponseCookies.IsDeleted(response, AuthCookies.Flow));
        Assert.IsTrue(host.Google.TokenRequests.IsEmpty);
    }

    [TestMethod]
    public async Task MissingCodeGoesBackToTheSignInPage()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();

        using var response = await host.GetAsync($"/auth/google/callback?state={attempt.State}", attempt.FlowCookie);

        AssertSignInPage(response);
    }

    [TestMethod]
    public async Task FlowCookieIsSingleUseOnTheBrowserSide()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();

        using var response = await host.CompleteAsync(attempt);

        Assert.IsTrue(ResponseCookies.IsDeleted(response, AuthCookies.Flow));
    }

    private static void AssertSignInPage(HttpResponseMessage response)
    {
        Assert.AreEqual(HttpStatusCode.Redirect, response.StatusCode);
        Assert.AreEqual(SignIn, response.Headers.Location!.AbsoluteUri);
        Assert.IsNull(ResponseCookies.Value(response, AuthCookies.Session));
    }
}
