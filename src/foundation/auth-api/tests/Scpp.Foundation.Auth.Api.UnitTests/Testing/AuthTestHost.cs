using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Scpp.Foundation.Auth.Api.Google;
using Scpp.Foundation.Auth.Api.Sessions;
using Serilog.Core;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

/// <summary>The real host, listening on loopback, with Google, the clock and logging replaced.</summary>
internal sealed class AuthTestHost : IAsyncDisposable
{
    internal const string ApiHost = "auth.example.org";
    internal const string FrontendOrigin = "https://frontend.example.org";
    internal const string ClientId = "test-client.apps.googleusercontent.com";
    internal const string ClientSecret = "test-client-secret";
    internal const string AuthorizationCode = "test-authorization-code";
    internal const string KeyRing = "{\"activeKeyId\":\"k2\",\"keys\":{" +
        "\"k1\":\"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=\"," +
        "\"k2\":\"ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=\"}}";

    private readonly WebApplication app;
    private readonly HttpClient client;

    private AuthTestHost(WebApplication app, HttpClient client, GoogleHttpStub google, TestClock clock, CollectingSink sink)
    {
        this.app = app;
        this.client = client;
        Google = google;
        Clock = clock;
        Sink = sink;
    }

    internal GoogleHttpStub Google { get; }

    internal TestClock Clock { get; }

    internal CollectingSink Sink { get; }

    internal static async Task<AuthTestHost> StartAsync(Action<WebApplicationBuilder>? configure = null)
    {
        var google = new GoogleHttpStub();
        var clock = new TestClock();
        var sink = new CollectingSink();
        var app = AuthApi.Build(["--urls", "http://127.0.0.1:0", "--environment", "Testing"], builder => {
            Configure(builder);
            builder.Services.AddSingleton<TimeProvider>(clock);
            builder.Services.AddSingleton<ILogEventSink>(sink);
            builder.Services.AddHttpClient<GoogleOidcClient>().ConfigurePrimaryHttpMessageHandler(() => google);
            builder.Services.AddHttpClient(GoogleEndpoints.MetadataClient).ConfigurePrimaryHttpMessageHandler(() => google);
            configure?.Invoke(builder);
        });
        await app.StartAsync();
        var client = new HttpClient(new SocketsHttpHandler { UseCookies = false, AllowAutoRedirect = false })
        {
            BaseAddress = new Uri(app.Urls.Single()),
        };
        return new(app, client, google, clock, sink);
    }

    public async ValueTask DisposeAsync()
    {
        client.Dispose();
        await app.DisposeAsync();
    }

    internal Task<HttpResponseMessage> GetAsync(string pathAndQuery, string? cookie = null, string host = ApiHost, string? origin = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, pathAndQuery);
        request.Headers.Host = host;
        if (cookie is not null) {
            request.Headers.Add("Cookie", cookie);
        }

        if (origin is not null) {
            request.Headers.Add("Origin", origin);
        }

        return client.SendAsync(request);
    }

    /// <summary>Calls <c>GET /auth/google</c> and returns what Google and the browser now hold.</summary>
    internal async Task<SignInAttempt> StartSignInAsync(string query = "")
    {
        using var response = await GetAsync("/auth/google" + query);
        Assert.AreEqual(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!;
        var parameters = QueryHelpers.ParseQuery(location.Query);
        var cookie = ResponseCookies.Value(response, AuthCookies.Flow);
        Assert.IsNotNull(cookie);
        return new(location, parameters["state"].ToString(), parameters["nonce"].ToString(),
            parameters["code_challenge"].ToString(), $"{AuthCookies.Flow}={cookie}");
    }

    /// <summary>Has Google return the given token, then calls the callback as the browser would.</summary>
    internal Task<HttpResponseMessage> CompleteAsync(SignInAttempt attempt, IdTokenClaims? claims = null,
        string? state = null, string? flowCookie = null, bool sendFlowCookie = true)
    {
        Google.IdToken = TestIdTokens.Create(claims ?? new IdTokenClaims(), attempt.Nonce, Clock.GetUtcNow());
        return GetAsync($"/auth/google/callback?code={AuthorizationCode}&state={Uri.EscapeDataString(state ?? attempt.State)}",
            sendFlowCookie ? flowCookie ?? attempt.FlowCookie : null);
    }

    /// <summary>A complete, valid sign-in; returns the callback response.</summary>
    internal async Task<HttpResponseMessage> SignInAsync(IdTokenClaims? claims = null) =>
        await CompleteAsync(await StartSignInAsync(), claims);

    private static void Configure(WebApplicationBuilder builder)
    {
        var configuration = builder.Configuration;
        configuration["AUTH_GOOGLE_CLIENT_SECRET"] = ClientSecret;
        configuration["AUTH_SESSION_KEYS"] = KeyRing;
        configuration["Auth:Google:ClientId"] = ClientId;
        configuration["Auth:ApiOrigin"] = "https://" + ApiHost;
        configuration["Auth:FrontendOrigin"] = FrontendOrigin;
        configuration["Auth:PostSignInPath"] = "/beheer";
        configuration["Auth:AllowedDomains:0"] = "scpp.nl";
        configuration["Auth:AllowedDomains:1"] = "blokhutdewildert.nl";
        configuration["Cors:AllowedOrigins:0"] = FrontendOrigin;
    }
}
