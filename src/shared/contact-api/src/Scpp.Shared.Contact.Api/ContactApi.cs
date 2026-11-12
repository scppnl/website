using Scpp.Shared.Contact.Api.Configuration;
using Scpp.Shared.Contact.Api.Endpoints;

namespace Scpp.Shared.Contact.Api;

internal static class ContactApi
{
    internal static WebApplication Build(string[] args, Action<WebApplicationBuilder>? configure = null)
    {
        var builder = WebApplication.CreateSlimBuilder(args);
        builder.AddApiLogging();
        builder.AddContactApi();
        configure?.Invoke(builder);
        builder.Services.AddSingleton(TurnstileConfiguration.Load(builder.Configuration, builder.Environment));
        var app = builder.Build();
        app.UseApiRequestLogging();
        app.UseCors();
        app.MapGet("/", DummyEndpoint.Get);
        app.MapPost("/api/contact", ContactEndpoint.Post);
        return app;
    }
}
