using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace Scpp.Shared.ContactApi;

internal static class ContactApi
{
    internal static WebApplication Build(string[] args, Action<WebApplicationBuilder>? configure = null)
    {
        var builder = WebApplication.CreateSlimBuilder(args);
        builder.Logging.AddJsonConsole();
        builder.Services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.TypeInfoResolverChain.Insert(0, ContactJsonContext.Default));
        builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
        {
            var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
            if (origins.Length > 0)
                policy.WithOrigins(origins).WithMethods("POST").WithHeaders("Content-Type");
        }));
        configure?.Invoke(builder);
        var app = builder.Build();
        app.UseCors();
        app.MapGet("/", DummyEndpoint.Get);
        app.MapPost("/api/contact", ContactRequestHandler.Post);
        return app;
    }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ContactRequest))]
[JsonSerializable(typeof(HttpValidationProblemDetails))]
internal partial class ContactJsonContext : JsonSerializerContext;
