using Scpp.Foundation.Booking.Api.Configuration;
using Scpp.Foundation.Booking.Api.Endpoints;
using Scpp.Foundation.Booking.Api.Logging;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Api.Validation;
using Scpp.Foundation.Booking.Api.Verification;

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
        builder.Services.AddHttpClient<TurnstileVerifier>(client => client.Timeout = TimeSpan.FromSeconds(10));
        configure?.Invoke(builder);
        builder.Services.AddSingleton(TurnstileSettings.Load(builder.Configuration, builder.Environment));

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
        app.MapPost("/bookings", BookingEndpoint.Post);
        return app;
    }
}
