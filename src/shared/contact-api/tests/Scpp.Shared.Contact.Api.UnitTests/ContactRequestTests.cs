using Scpp.Shared.Contact.Models;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Serilog.Core;
using Serilog.Events;

namespace Scpp.Shared.Contact.Api.UnitTests;

[TestClass]
public sealed class ContactRequestTests
{
    private WebApplication app = null!;
    private HttpClient client = null!;
    private readonly RequestLogs logs = new();
    private readonly SiteverifyStub siteverify = new();
    private static ContactRequest Valid(string source = "foundation") =>
        new(source, " Jan Jansen ", " jan@example.nl ", " Hello\nworld ",
            source == "association" ? " Piet " : null,
            source == "foundation" ? " 0164 123456 " : null,
            source == "foundation" ? "question" : null, "test-token");

    [TestInitialize]
    public async Task Start()
    {
        app = ContactApi.Build(["--urls", "http://127.0.0.1:0", "--Cors:AllowedOrigins:0", "http://localhost:4173",
            "--Turnstile:SecretKey", "test-secret", "--Turnstile:AllowedHostnames:0", "scpp.nl"],
            builder => {
                builder.Services.AddSingleton<ILogEventSink>(logs);
                builder.Services.AddHttpClient<TurnstileVerifier>().ConfigurePrimaryHttpMessageHandler(() => siteverify);
            });
        await app.StartAsync();
        var addresses = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!;
        client = new HttpClient { BaseAddress = new Uri(addresses.Addresses.Single()) };
    }

    [TestCleanup]
    public async Task Stop()
    {
        client.Dispose();
        await app.DisposeAsync();
    }

    [TestMethod]
    [DataRow("association")]
    [DataRow("foundation")]
    public async Task AcceptsBothFormsAndLogsEveryNormalizedFieldOnce(string source)
    {
        var response = await client.PostAsJsonAsync("/api/contact", Valid(source));
        Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
        Assert.AreEqual("", await response.Content.ReadAsStringAsync());
        var entry = logs.Entries.Single();
        Assert.AreEqual(source, entry["Source"]);
        Assert.AreEqual("Jan Jansen", entry["Name"]);
        Assert.AreEqual("jan@example.nl", entry["Email"]);
        Assert.AreEqual("Hello\nworld", entry["Message"]);
        Assert.AreEqual(source == "association" ? "Piet" : null, entry["ChildName"]);
        Assert.AreEqual(source == "foundation" ? "0164 123456" : null, entry["Phone"]);
        Assert.AreEqual(source == "foundation" ? "question" : null, entry["Subject"]);
        Assert.IsNotNull(entry["Timestamp"]);
        Assert.IsFalse(string.IsNullOrEmpty(entry["TraceId"]?.ToString()));
    }

    [TestMethod]
    public void NormalizesBlankOptionalValues()
    {
        var (request, errors) = ContactRequestValidator.Validate(Valid() with { Phone = "  ", ChildName = " " });
        Assert.IsNull(request.Phone);
        Assert.IsNull(request.ChildName);
        Assert.AreEqual(0, errors.Count);
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow(" \t\n ")]
    public async Task RejectsMissingAndWhitespaceRequiredFields(string? value)
    {
        var response = await client.PostAsJsonAsync("/api/contact", Valid() with { Name = value, Email = value, Message = value });
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.AreEqual("application/problem+json", response.Content.Headers.ContentType!.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var errors = body.RootElement.GetProperty("errors");
        foreach (var key in new[] { "name", "email", "message" }) Assert.IsTrue(errors.TryGetProperty(key, out _));
        Assert.AreEqual(0, logs.Entries.Count);
    }

    [TestMethod]
    [DataRow("name", 200)]
    [DataRow("email", 254)]
    [DataRow("message", 10000)]
    [DataRow("childName", 200)]
    [DataRow("phone", 50)]
    public void EnforcesLengthBoundariesAfterTrimming(string field, int max)
    {
        ContactRequest Set(int length)
        {
            var value = field == "email" ? new string('a', length - 5) + "@b.nl" : new string('x', length);
            value = " " + value + " ";
            return field switch
            {
                "name" => Valid() with { Name = value },
                "email" => Valid() with { Email = value },
                "message" => Valid() with { Message = value },
                "childName" => Valid() with { ChildName = value },
                _ => Valid() with { Phone = value }
            };
        }
        Assert.IsFalse(ContactRequestValidator.Validate(Set(max)).Errors.ContainsKey(field));
        Assert.IsTrue(ContactRequestValidator.Validate(Set(max + 1)).Errors.ContainsKey(field));
    }

    [TestMethod]
    public async Task RejectsInvalidEmailSourceAndSubjectWithoutLogging()
    {
        foreach (var request in new[] {
            Valid() with { Email = "invalid" }, Valid() with { Email = "invalid address@example.nl" }, Valid() with { Source = "other" },
            Valid() with { Source = null }, Valid() with { Subject = "bad" },
            Valid() with { Subject = null }, Valid("association") with { Subject = "question" }
        })
            Assert.AreEqual(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/contact", request)).StatusCode);
        Assert.AreEqual(0, logs.Entries.Count);
    }

    [TestMethod]
    [DataRow("question")]
    [DataRow("viewing")]
    [DataRow("other")]
    public async Task AcceptsAllFoundationSubjects(string subject) =>
        Assert.AreEqual(HttpStatusCode.NoContent,
            (await client.PostAsJsonAsync("/api/contact", Valid() with { Subject = subject })).StatusCode);

    [TestMethod]
    [DataRow("{", "application/json", HttpStatusCode.BadRequest)]
    [DataRow("null", "application/json", HttpStatusCode.BadRequest)]
    [DataRow("{\"name\":123}", "application/json", HttpStatusCode.BadRequest)]
    [DataRow("hello", "text/plain", HttpStatusCode.UnsupportedMediaType)]
    public async Task RejectsMalformedBodies(string body, string type, HttpStatusCode status)
    {
        var response = await client.PostAsync("/api/contact", new StringContent(body, Encoding.UTF8, type));
        Assert.AreEqual(status, response.StatusCode);
        Assert.AreEqual(0, logs.Entries.Count);
    }

    [TestMethod]
    public async Task OnlyAllowsConfiguredCorsOrigin()
    {
        foreach (var origin in new[] { "http://localhost:4173", "https://untrusted.example" })
        {
            using var request = new HttpRequestMessage(HttpMethod.Options, "/api/contact");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "POST");
            request.Headers.Add("Access-Control-Request-Headers", "content-type");
            var response = await client.SendAsync(request);
            Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
            Assert.AreEqual(origin == "http://localhost:4173", response.Headers.Contains("Access-Control-Allow-Origin"));
            Assert.IsFalse(response.Headers.Contains("Access-Control-Allow-Credentials"));
        }
    }

    [TestMethod]
    public async Task RequiresVerificationBeforeReceipt()
    {
        foreach (var token in new[] { null, "", "  ", new string('x', 2049) })
        {
            var response = await client.PostAsJsonAsync("/api/contact", Valid() with { TurnstileToken = token });
            Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
            StringAssert.Contains(await response.Content.ReadAsStringAsync(), "turnstileToken");
        }
        Assert.AreEqual(0, siteverify.Calls);
        Assert.AreEqual(0, logs.Entries.Count);
    }

    [TestMethod]
    public async Task SendsOnlySecretAndTokenToCanonicalSiteverify()
    {
        Assert.AreEqual(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/contact", Valid())).StatusCode);
        Assert.AreEqual("https://challenges.cloudflare.com/turnstile/v0/siteverify", siteverify.Url);
        Assert.AreEqual("secret=test-secret&response=test-token", siteverify.Body);
        Assert.IsFalse(logs.Entries.Single().ContainsKey("TurnstileToken"));
    }

    [TestMethod]
    public async Task AcceptsMaximumTokenLength()
    {
        Assert.AreEqual(HttpStatusCode.NoContent,
            (await client.PostAsJsonAsync("/api/contact", Valid() with { TurnstileToken = new string('x', 2048) })).StatusCode);
        Assert.AreEqual(1, siteverify.Calls);
    }

    [TestMethod]
    [DataRow("{\"success\":false,\"error-codes\":[\"timeout-or-duplicate\"]}")]
    [DataRow("{\"success\":true,\"hostname\":\"evil.example\",\"action\":\"contact\"}")]
    [DataRow("{\"success\":true,\"hostname\":\"scpp.nl\",\"action\":\"login\"}")]
    [DataRow("{\"success\":true}")]
    public async Task RejectsFailedExpiredDuplicateAndMismatchedVerification(string body)
    {
        siteverify.Response = body;
        var response = await client.PostAsJsonAsync("/api/contact", Valid());
        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.AreEqual("application/problem+json", response.Content.Headers.ContentType!.MediaType);
        Assert.AreEqual(0, logs.Entries.Count);
    }

    [TestMethod]
    [DataRow("null", 200)]
    [DataRow("{}", 200)]
    [DataRow("not json", 200)]
    [DataRow("{}", 500)]
    public async Task ProviderFailuresAreUnavailableWithoutReceipt(string body, int status)
    {
        siteverify.Response = body;
        siteverify.Status = (HttpStatusCode)status;
        Assert.AreEqual(HttpStatusCode.ServiceUnavailable, (await client.PostAsJsonAsync("/api/contact", Valid())).StatusCode);
        Assert.AreEqual(0, logs.Entries.Count);
    }

    [TestMethod]
    public async Task ValidationErrorsDoNotRedeemTokens()
    {
        Assert.AreEqual(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/contact", Valid() with { Name = null })).StatusCode);
        Assert.AreEqual(0, siteverify.Calls);
    }

    private sealed class RequestLogs : ILogEventSink
    {
        internal ConcurrentBag<Dictionary<string, object?>> Entries { get; } = [];

        public void Emit(LogEvent logEvent)
        {
            if (logEvent.Level == LogEventLevel.Information &&
                logEvent.Properties.TryGetValue("SourceContext", out var category) &&
                ((ScalarValue)category).Value?.ToString() == typeof(ContactRequestHandler).FullName)
                Entries.Add(logEvent.Properties.ToDictionary(property => property.Key,
                    property => ((ScalarValue)property.Value).Value));
        }
    }
}
