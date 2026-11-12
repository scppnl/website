using Scpp.Shared.Contact.Models;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace Scpp.Shared.Contact.Api;

internal static class ContactApi
{
    internal static WebApplication Build(string[] args, Action<WebApplicationBuilder>? configure = null)
    {
        var builder = WebApplication.CreateSlimBuilder(args);
        builder.AddApiLogging();
        builder.Services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.TypeInfoResolverChain.Insert(0, ContactJsonContext.Default));
        builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
        {
            var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
            if (origins.Length > 0)
                policy.WithOrigins(origins).WithMethods("POST").WithHeaders("Content-Type");
        }));
        builder.Services.AddHttpClient<TurnstileVerifier>(client => client.Timeout = TimeSpan.FromSeconds(10));
        configure?.Invoke(builder);
        builder.Services.AddSingleton(TurnstileSettings.Load(builder.Configuration, builder.Environment));
        var app = builder.Build();
        app.UseApiRequestLogging();
        app.UseCors();
        app.MapGet("/", DummyEndpoint.Get);
        app.MapPost("/contact", ContactRequestHandler.Post);
        return app;
    }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ContactRequest))]
[JsonSerializable(typeof(HttpValidationProblemDetails))]
[JsonSerializable(typeof(ProblemDetails))]
[JsonSerializable(typeof(TurnstileResponse))]
internal partial class ContactJsonContext : JsonSerializerContext;
