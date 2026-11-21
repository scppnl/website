using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Scpp.Foundation.Auth.Api.Access;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Endpoints;
using Scpp.Foundation.Auth.Api.Google;
using Scpp.Foundation.Auth.Api.Http;
using Scpp.Foundation.Auth.Api.Logging;
using Scpp.Foundation.Auth.Api.Serialization;
using Scpp.Foundation.Auth.Api.Sessions;

namespace Scpp.Foundation.Auth.Api;

internal static class AuthApi
{
    internal static WebApplication Build(string[] args, Action<WebApplicationBuilder>? configure = null)
    {
        var builder = WebApplication.CreateSlimBuilder(args);
        builder.AddApiLogging();
        AddServices(builder);
        configure?.Invoke(builder);
        var settings = AuthSettings.Load(builder.Configuration, builder.Environment);
        builder.Services.AddSingleton(settings);
        builder.Services.AddSingleton(SessionKeyRing.Load(builder.Configuration["AUTH_SESSION_KEYS"]));
        AddCors(builder, settings);

        var app = builder.Build();
        app.UseApiRequestLogging();
        app.UseCors();
        app.UseAuthNoStore();
        MapEndpoints(app);
        return app;
    }

    private static void MapEndpoints(WebApplication app)
    {
        app.MapGet("/", DummyEndpoint.Get);
        app.MapGet("/auth/google", (HttpContext context, GoogleSignInEndpoint endpoint) => endpoint.Get(context));
        app.MapGet("/auth/google/callback", (HttpContext context, GoogleCallbackEndpoint endpoint, CancellationToken cancellationToken) =>
            endpoint.GetAsync(context, cancellationToken));
        app.MapGet("/auth/session", (HttpContext context, SessionEndpoint endpoint, CancellationToken cancellationToken) =>
            endpoint.GetAsync(context, cancellationToken));
        app.MapDelete("/auth/session", (HttpContext context, SignOutEndpoint endpoint) => endpoint.Delete(context));
    }

    private static void AddServices(WebApplicationBuilder builder)
    {
        builder.Services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.TypeInfoResolverChain.Insert(0, AuthJsonContext.Default));
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<CookieProtector>();
        builder.Services.AddSingleton<AccessPolicy>();
        builder.Services.AddSingleton<GoogleIdTokenValidator>();
        builder.Services.AddHttpClient(GoogleEndpoints.MetadataClient, client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(services =>
            new ConfigurationManager<OpenIdConnectConfiguration>(
                GoogleEndpoints.Discovery,
                new OpenIdConnectConfigurationRetriever(),
                new HttpDocumentRetriever(services.GetRequiredService<IHttpClientFactory>().CreateClient(GoogleEndpoints.MetadataClient))
                {
                    RequireHttps = true,
                }));
        builder.Services.AddHttpClient<GoogleOidcClient>(client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        AddPermissionServices(builder);
        builder.Services.AddScoped<GoogleSignInEndpoint>();
        builder.Services.AddScoped<GoogleCallbackEndpoint>();
        builder.Services.AddScoped<SessionEndpoint>();
        builder.Services.AddScoped<SignOutEndpoint>();
    }

    private static void AddPermissionServices(WebApplicationBuilder builder)
    {
        builder.Services.AddHttpClient(GoogleEndpoints.CloudClient, client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddSingleton<MetadataTokenSource>();
        builder.Services.AddSingleton<GoogleGroupsClient>();
        builder.Services.AddSingleton<GroupMembershipCache>();
        builder.Services.AddSingleton<PermissionResolver>();
    }

    private static void AddCors(WebApplicationBuilder builder, AuthSettings settings)
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins")
            .GetChildren().Select(origin => origin.Value).OfType<string>().ToArray();
        if (allowedOrigins.Contains("*")) {
            throw new InvalidOperationException("Cors:AllowedOrigins must contain explicit origins, not '*'.");
        }

        if (!allowedOrigins.Contains(settings.FrontendOrigin.GetLeftPart(UriPartial.Authority), StringComparer.Ordinal)) {
            throw new InvalidOperationException("Cors:AllowedOrigins must contain Auth:FrontendOrigin.");
        }

        builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
            policy.WithOrigins(allowedOrigins).WithMethods("GET", "DELETE").AllowCredentials()));
    }
}
