using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Scpp.Foundation.Auth.Api.Logging;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;
using Serilog.Core;
using Serilog.Events;

namespace Scpp.Foundation.Auth.Api.UnitTests.Logging;

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

        using (logger.BeginScope(new Dictionary<string, object> { ["OperationId"] = "test-operation" })) {
            logger.LogError(exception, "Failed operation {Attempt}", 3);
        }

        var logEvent = sink.Events.Single();
        Assert.AreEqual(LogEventLevel.Error, logEvent.Level);
        Assert.AreEqual("Failed operation {Attempt}", logEvent.MessageTemplate.Text);
        Assert.AreEqual(3, ((ScalarValue)logEvent.Properties["Attempt"]).Value);
        Assert.AreEqual("test-operation", ((ScalarValue)logEvent.Properties["OperationId"]).Value);
        Assert.AreEqual(typeof(LoggingTests).FullName, ((ScalarValue)logEvent.Properties["SourceContext"]).Value);
        Assert.AreEqual("Scpp.Foundation.Auth.Api", ((ScalarValue)logEvent.Properties["Application"]).Value);
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
    public async Task RequestsUseTheHostLoggerAndRecordMethodPathStatusAndDuration()
    {
        await using var host = await AuthTestHost.StartAsync();

        foreach (var path in new[] { "/", "/missing", "/auth/session" }) {
            using var response = await host.GetAsync(path);
        }

        var requests = RequestEvents(host.Sink).OrderBy(Path, StringComparer.Ordinal).ToArray();
        CollectionAssert.AreEqual(new[] { "/", "/auth/session", "/missing" }, requests.Select(Path).ToArray());
        CollectionAssert.AreEqual(new[] { 200, 401, 404 },
            requests.Select(logEvent => (int)((ScalarValue)logEvent.Properties["StatusCode"]).Value!).ToArray());
        foreach (var logEvent in requests) {
            Assert.AreEqual("GET", ((ScalarValue)logEvent.Properties["RequestMethod"]).Value);
            Assert.IsGreaterThanOrEqualTo(0d, (double)((ScalarValue)logEvent.Properties["Elapsed"]).Value!);
            Assert.AreEqual("Testing", ((ScalarValue)logEvent.Properties["Environment"]).Value);
        }
    }

    [TestMethod]
    public async Task SignInLogsOnlyTheOutcomeAndNeverSecretsTokensOrTheEmail()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync("?prompt=select_account");
        using var success = await host.CompleteAsync(attempt, new IdTokenClaims { Email = "private.person@scpp.nl" });
        var denied = await host.StartSignInAsync();
        using var wrongDomain = await host.CompleteAsync(denied, new IdTokenClaims { Email = "stranger@example.org", HostedDomain = null });
        var tampered = await host.StartSignInAsync();
        using var invalidState = await host.CompleteAsync(tampered, state: "forged-state-value");

        var outcomes = host.Sink.Events
            .Where(logEvent => logEvent.MessageTemplate.Text == "Google sign-in finished with {Outcome}")
            .Select(logEvent => (logEvent.Level, Outcome: ((ScalarValue)logEvent.Properties["Outcome"]).Value!.ToString()))
            .ToArray();
        CollectionAssert.AreEqual(
            new[] { (LogEventLevel.Information, "Success"), (LogEventLevel.Warning, "WrongDomain"), (LogEventLevel.Warning, "InvalidState") },
            outcomes);

        var everything = string.Join('\n', host.Sink.Events.Select(Describe));
        foreach (var secret in new[]
        {
            AuthTestHost.AuthorizationCode, AuthTestHost.ClientSecret, host.Google.IdToken, attempt.State, attempt.Nonce, attempt.Challenge,
            "private.person@scpp.nl", "stranger@example.org", "forged-state-value", "code=", "state=", "nonce=",
            ResponseCookies.Value(success, "__Host-scpp-session")!,
        }) {
            Assert.DoesNotContain(secret, everything);
        }
    }

    [TestMethod]
    public async Task RequestLogsRecordThePathWithoutTheQueryString()
    {
        await using var host = await AuthTestHost.StartAsync();
        var attempt = await host.StartSignInAsync();

        using var response = await host.CompleteAsync(attempt);

        var callback = RequestEvents(host.Sink).Single(logEvent => Path(logEvent) == "/auth/google/callback");
        Assert.AreEqual(302, (int)((ScalarValue)callback.Properties["StatusCode"]).Value!);
        Assert.DoesNotContain(AuthTestHost.AuthorizationCode, Describe(callback));
    }

    private static IEnumerable<LogEvent> RequestEvents(CollectingSink sink) =>
        sink.Events.Where(logEvent => logEvent.Properties.TryGetValue("SourceContext", out var source) &&
            ((ScalarValue)source).Value?.ToString() == "Serilog.AspNetCore.RequestLoggingMiddleware");

    private static string Path(LogEvent logEvent) => ((ScalarValue)logEvent.Properties["RequestPath"]).Value!.ToString()!;

    private static string Describe(LogEvent logEvent) =>
        logEvent.RenderMessage() + " " + string.Join(' ', logEvent.Properties.Select(pair => $"{pair.Key}={pair.Value}")) + " " + logEvent.Exception;

    private static WebApplicationBuilder CreateBuilder(CollectingSink sink)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions
        {
            ApplicationName = typeof(AuthApi).Assembly.GetName().Name,
            EnvironmentName = "Testing",
        });
        builder.Services.AddSingleton<ILogEventSink>(sink);
        return builder;
    }
}
