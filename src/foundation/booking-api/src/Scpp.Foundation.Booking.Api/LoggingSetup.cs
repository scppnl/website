using Serilog;
using Serilog.Events;

namespace Scpp.Foundation.Booking.Api;

internal static class LoggingSetup
{
    internal static void AddApiLogging(this WebApplicationBuilder builder)
    {
        builder.Logging.ClearProviders();
        builder.Services.AddSerilog((services, configuration) => configuration
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Application", builder.Environment.ApplicationName)
            .Enrich.WithProperty("Environment", builder.Environment.EnvironmentName)
            .ReadFrom.Services(services)
            .WriteTo.Console(outputTemplate:
                "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {SourceContext} {Message:lj} {Properties:j}{NewLine}{Exception}"),
            preserveStaticLogger: true);
    }

    internal static void UseApiRequestLogging(this WebApplication app) =>
        app.UseSerilogRequestLogging(options =>
            options.Logger = app.Services.GetRequiredService<Serilog.ILogger>());
}
