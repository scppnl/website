using Scpp.Foundation.Booking.Api.Endpoints;
using Scpp.Foundation.Booking.Api.Logging;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Api.Validation;

namespace Scpp.Foundation.Booking.Api;

internal static class BookingApi
{
    internal static WebApplication Build(string[] args, Action<WebApplicationBuilder>? configure = null)
    {
        var builder = WebApplication.CreateSlimBuilder(args);
        builder.AddApiLogging();
        builder.Services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.TypeInfoResolverChain.Insert(0, BookingJsonContext.Default));
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<BookingRequestValidator>();
        configure?.Invoke(builder);

        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins")
            .GetChildren().Select(origin => origin.Value).OfType<string>().ToArray();
        if (allowedOrigins.Contains("*"))
            throw new InvalidOperationException("Cors:AllowedOrigins must contain explicit origins, not '*'.");
        builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
            policy.WithOrigins(allowedOrigins).WithMethods("POST").WithHeaders("Content-Type")));

        var app = builder.Build();
        app.UseApiRequestLogging();
        app.UseCors();
        app.MapGet("/", DummyEndpoint.Get);
        app.MapPost("/api/bookings", BookingEndpoint.Post);
        return app;
    }
}
