using System.Collections.Concurrent;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Foundation.Booking.Api.Endpoints;
using Scpp.Foundation.Booking.Api.Logging;
using Serilog.Core;
using Serilog.Events;

namespace Scpp.Foundation.Booking.Api.UnitTests;

[TestClass]
public sealed class LoggingTests
{
    [TestMethod]
    public async Task MicrosoftLoggerPreservesStructuredPropertiesScopeAndException()
    {
        var sink = new CollectingSink();
        var builder = CreateBuilder(sink);
        builder.AddApiLogging();
        await using var app = builder.Build();
        var logger = app.Services.GetRequiredService<ILogger<LoggingTests>>();
        var exception = new InvalidOperationException("Test failure");

        using (logger.BeginScope(new Dictionary<string, object> { ["OperationId"] = "test-operation" }))
        {
            logger.LogError(exception, "Failed operation {Attempt}", 3);
        }

        var logEvent = sink.Events.Single();
        Assert.AreEqual(LogEventLevel.Error, logEvent.Level);
        Assert.AreEqual("Failed operation {Attempt}", logEvent.MessageTemplate.Text);
        Assert.AreEqual(3, ((ScalarValue)logEvent.Properties["Attempt"]).Value);
        Assert.AreEqual("test-operation", ((ScalarValue)logEvent.Properties["OperationId"]).Value);
        Assert.AreEqual(typeof(LoggingTests).FullName, ((ScalarValue)logEvent.Properties["SourceContext"]).Value);
        Assert.AreEqual("Scpp.Foundation.Booking.Api", ((ScalarValue)logEvent.Properties["Application"]).Value);
        Assert.AreEqual("Testing", ((ScalarValue)logEvent.Properties["Environment"]).Value);
        Assert.AreSame(exception, logEvent.Exception);
        Assert.IsEmpty(app.Services.GetServices<ILoggerProvider>());
    }

    [TestMethod]
    public async Task DefaultLevelsKeepApplicationInformationAndSuppressFrameworkNoise()
    {
        var sink = new CollectingSink();
        var builder = CreateBuilder(sink);
        builder.AddApiLogging();
        await using var app = builder.Build();
        var factory = app.Services.GetRequiredService<ILoggerFactory>();
        var application = factory.CreateLogger("Application");
        var aspnet = factory.CreateLogger("Microsoft.AspNetCore.Hosting");
        var system = factory.CreateLogger("System.Net.Http.HttpClient");

        application.LogDebug("Hidden debug event");
        application.LogInformation("Visible application event");
        aspnet.LogInformation("Hidden request event");
        system.LogInformation("Hidden system event");
        aspnet.LogWarning("Visible framework warning");
        system.LogWarning("Visible system warning");

        CollectionAssert.AreEqual(
            new[] { "Visible application event", "Visible framework warning", "Visible system warning" },
            sink.Events.Select(logEvent => logEvent.RenderMessage()).ToArray());
    }

    [TestMethod]
    public async Task RequestsUseTheHostLoggerAndRecordStatusDurationAndErrors()
    {
        var sink = new CollectingSink();
        var builder = CreateBuilder(sink);
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.AddApiLogging();
        await using var app = builder.Build();
        app.UseApiRequestLogging();
        app.MapGet("/", DummyEndpoint.Get);
        app.MapGet("/failure", () => Results.StatusCode(500));
        app.MapGet("/throw", (Func<IResult>)(() => throw new InvalidOperationException("Request failed")));

        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        foreach (var path in new[] { "/", "/missing", "/failure", "/throw" })
        {
            using var response = await client.GetAsync(path);
            await response.Content.ReadAsStringAsync();
        }
        await app.StopAsync();

        var requests = sink.Events.Where(logEvent =>
            logEvent.Properties.TryGetValue("SourceContext", out var source) &&
            ((ScalarValue)source).Value?.ToString() == "Serilog.AspNetCore.RequestLoggingMiddleware")
            .OrderBy(logEvent => ((ScalarValue)logEvent.Properties["RequestPath"]).Value?.ToString(), StringComparer.Ordinal)
            .ToArray();
        Assert.HasCount(4, requests);
        CollectionAssert.AreEqual(new[] { 200, 500, 404, 500 },
            requests.Select(logEvent => (int)((ScalarValue)logEvent.Properties["StatusCode"]).Value!).ToArray());
        CollectionAssert.AreEqual(new[] { LogEventLevel.Information, LogEventLevel.Error, LogEventLevel.Information, LogEventLevel.Error },
            requests.Select(logEvent => logEvent.Level).ToArray());
        foreach (var logEvent in requests)
        {
            Assert.AreEqual("GET", ((ScalarValue)logEvent.Properties["RequestMethod"]).Value);
            Assert.IsGreaterThanOrEqualTo(0d, (double)((ScalarValue)logEvent.Properties["Elapsed"]).Value!);
            Assert.AreEqual("Scpp.Foundation.Booking.Api", ((ScalarValue)logEvent.Properties["Application"]).Value);
            Assert.AreEqual("Testing", ((ScalarValue)logEvent.Properties["Environment"]).Value);
        }
        Assert.IsInstanceOfType<InvalidOperationException>(requests[^1].Exception);
    }

    private static WebApplicationBuilder CreateBuilder(CollectingSink sink)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions
        {
            ApplicationName = typeof(LoggingSetup).Assembly.GetName().Name,
            EnvironmentName = "Testing"
        });
        builder.Services.AddSingleton<ILogEventSink>(sink);
        return builder;
    }

    private sealed class CollectingSink : ILogEventSink
    {
        internal ConcurrentQueue<LogEvent> Events { get; } = new();

        public void Emit(LogEvent logEvent) => Events.Enqueue(logEvent);
    }
}
