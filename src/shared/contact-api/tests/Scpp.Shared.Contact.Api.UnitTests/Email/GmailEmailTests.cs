using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Shared.Contact.Api.Configuration;
using Scpp.Shared.Contact.Infrastructure.Email;
using Scpp.Shared.Contact.Domain.Models;

namespace Scpp.Shared.Contact.Api.UnitTests.Email;

[TestClass]
public sealed class GmailEmailTests
{
    private static ContactEmailSettings Settings() => new("noreply@scpp.nl", "stichting@scpp.nl", "info@scpp.nl",
        new() { ClientId = "client+id", ClientSecret = "secret&", RefreshToken = "refresh/" });

    private static ContactSubmission Request(string source = "foundation") => new(
        source, "José Jansen", "renter@example.org", "Eén vraag:\nKunnen wij koffie zetten?\nBcc: nobody@example.org",
        source == "association" ? "Zoë" : null, source == "foundation" ? "0123456789" : null,
        source == "foundation" ? "viewing" : null);

    [TestMethod]
    public async Task ProviderExceptionDataNeverEntersLogs()
    {
        using var stub = new GmailHttpStub();
        stub.Respond = (_, _) => throw new HttpRequestException("secret-token and private message");
        var logs = new EmailLogRecorder();
        var settings = Settings();
        using var tokens = new GmailTokenProvider(stub, settings, new EmailTestClock());
        using var client = stub.CreateClient("");
        var sender = new GmailContactEmailSender(client, tokens, settings, new EmailTestClock(), logs);
        Assert.IsFalse(await sender.SendAsync(Request(), CancellationToken.None));
        Assert.IsTrue(logs.Messages.Any(message => message.Contains("network", StringComparison.Ordinal)));
        Assert.IsFalse(logs.Messages.Any(message => message.Contains("secret-token", StringComparison.Ordinal)));
        Assert.IsEmpty(logs.Exceptions);
    }

    [TestMethod]
    [DataRow("foundation", "stichting@scpp.nl")]
    [DataRow("association", "info@scpp.nl")]
    public async Task SendsCompleteMimeMessageWithFixedRecipientsAndSafeReplyTo(string source, string to)
    {
        using var stub = new GmailHttpStub();
        var clock = new EmailTestClock();
        using var tokens = new GmailTokenProvider(stub, Settings(), clock);
        using var http = stub.CreateClient("");
        var sender = new GmailContactEmailSender(http, tokens, Settings(), clock, NullLogger<GmailContactEmailSender>.Instance);
        Assert.IsTrue(await sender.SendAsync(Request(source), CancellationToken.None));
        Assert.HasCount(2, stub.Requests);
        var requests = stub.Requests.ToArray();
        Assert.AreEqual("https://oauth2.googleapis.com/token", requests[0].Url);
        Assert.AreEqual("grant_type=refresh_token&client_id=client%2Bid&client_secret=secret%26&refresh_token=refresh%2F", requests[0].Body);
        Assert.AreEqual("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", requests[1].Url);
        Assert.AreEqual("Bearer access", requests[1].Authorization);
        using var json = JsonDocument.Parse(requests[1].Body);
        var raw = json.RootElement.GetProperty("raw").GetString()!;
        var padded = raw.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight((padded.Length + 3) / 4 * 4, '=');
        var mime = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
        var parts = mime.Split("\r\n\r\n", 2);
        StringAssert.Contains(parts[0], $"From: noreply@scpp.nl\r\nTo: {to}\r\nReply-To: renter@example.org");
        StringAssert.Contains(parts[0], "Content-Type: text/plain; charset=utf-8");
        Assert.IsFalse(parts[0].Contains("Bcc:"));
        var subject = parts[0].Split("Subject: =?utf-8?B?")[1].Split("?=")[0];
        Assert.AreEqual(source == "foundation" ? "Contact stichting – Bezichtiging" : "Contact vereniging", Encoding.UTF8.GetString(Convert.FromBase64String(subject)));
        var body = Encoding.UTF8.GetString(Convert.FromBase64String(parts[1]));
        foreach (var value in new[] { "José Jansen", "renter@example.org", "Eén vraag:\r\nKunnen wij koffie zetten?" })
            StringAssert.Contains(body, value);
        StringAssert.Contains(body, source == "foundation" ? "Telefoon: 0123456789" : "Naam kind: Zoë");
        Assert.IsFalse(parts[0].Contains(source == "foundation" ? "info@scpp.nl" : "stichting@scpp.nl"));
    }

    [TestMethod]
    [DataRow("question", "Algemene vraag")]
    [DataRow("viewing", "Bezichtiging")]
    [DataRow("other", "Anders")]
    public void FoundationSubjectsAndMissingPhoneAreReadable(string subject, string label)
    {
        var raw = ContactEmailMessage.Create(Request() with { Subject = subject, Phone = null }, Settings(), DateTimeOffset.UtcNow);
        var encoded = raw.Replace('-', '+').Replace('_', '/');
        var mime = Encoding.UTF8.GetString(Convert.FromBase64String(encoded.PadRight((encoded.Length + 3) / 4 * 4, '=')));
        var body = Encoding.UTF8.GetString(Convert.FromBase64String(mime.Split("\r\n\r\n", 2)[1]));
        StringAssert.Contains(body, "Telefoon: Niet opgegeven");
        StringAssert.Contains(body, $"Onderwerp: {label}");
    }

    [TestMethod]
    public async Task RefreshIsCachedAcrossConcurrentSubmissionsAndRenewedBeforeExpiry()
    {
        using var stub = new GmailHttpStub();
        var clock = new EmailTestClock();
        using var tokens = new GmailTokenProvider(stub, Settings(), clock);
        stub.Respond = async (_, _) => {
            await Task.Yield();
            return new(HttpStatusCode.OK) { Content = new StringContent(stub.OAuthResponse) };
        };
        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => tokens.GetTokenAsync(CancellationToken.None)));
        Assert.HasCount(1, stub.Requests);
        clock.Now = clock.Now.AddSeconds(3541);
        await tokens.GetTokenAsync(CancellationToken.None);
        Assert.HasCount(2, stub.Requests);
    }

    [TestMethod]
    [DataRow(true, 400)]
    [DataRow(true, 401)]
    [DataRow(false, 401)]
    [DataRow(false, 403)]
    [DataRow(false, 429)]
    [DataRow(false, 500)]
    public async Task ProviderErrorsFailWithoutRetry(bool oauth, int status)
    {
        using var stub = new GmailHttpStub();
        if (oauth) stub.OAuthStatus = (HttpStatusCode)status;
        else stub.GmailStatus = (HttpStatusCode)status;
        Assert.IsFalse(await SendAsync(stub));
        Assert.AreEqual(oauth ? 1 : 2, stub.Requests.Count);
    }

    [TestMethod]
    [DataRow(true, "not-json")]
    [DataRow(true, "null")]
    [DataRow(true, "{}")]
    [DataRow(true, "{\"access_token\":\"a\",\"expires_in\":1,\"token_type\":\"Bearer\"}")]
    [DataRow(false, "not-json")]
    [DataRow(false, "null")]
    [DataRow(false, "{}")]
    public async Task MalformedResponsesFailClosed(bool oauth, string response)
    {
        using var stub = new GmailHttpStub();
        if (oauth) stub.OAuthResponse = response;
        else stub.GmailResponse = response;
        Assert.IsFalse(await SendAsync(stub));
    }

    [TestMethod]
    public async Task NetworkErrorsAndProviderTimeoutsFailWhileCallerCancellationPropagates()
    {
        using var stub = new GmailHttpStub();
        stub.Respond = (_, _) => throw new HttpRequestException("must not be exposed");
        Assert.IsFalse(await SendAsync(stub));
        stub.Respond = (_, _) => throw new TaskCanceledException("provider timeout");
        Assert.IsFalse(await SendAsync(stub));
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        stub.Respond = async (_, token) => {
            entered.SetResult();
            await Task.Delay(Timeout.Infinite, token);
            return new(HttpStatusCode.OK);
        };
        using var cancellation = new CancellationTokenSource();
        var sending = SendAsync(stub, cancellation.Token);
        await entered.Task;
        cancellation.Cancel();
        await Assert.ThrowsAsync<OperationCanceledException>(() => sending);
    }

    [TestMethod]
    [DataRow("a@example.org\r\nBcc: victim@example.org")]
    [DataRow("a@example.org,b@example.org")]
    [DataRow("Name<a@example.org>")]
    [DataRow("a@example.org\n")]
    public void UnsafeReplyAddressesAreRejected(string address) => Assert.IsFalse(MailboxAddress.IsValid(address));

    [TestMethod]
    [DataRow("renter@example.org")]
    [DataRow("renter@localhost")]
    public void SafeSingleMailboxesAreAccepted(string address) => Assert.IsTrue(MailboxAddress.IsValid(address));

    [TestMethod]
    public async Task UnauthorizedSendInvalidatesCacheWithoutRetryingTheMessage()
    {
        using var stub = new GmailHttpStub { GmailStatus = HttpStatusCode.Unauthorized };
        var clock = new EmailTestClock();
        using var tokens = new GmailTokenProvider(stub, Settings(), clock);
        using var http = stub.CreateClient("");
        var logger = new EmailLogRecorder();
        var sender = new GmailContactEmailSender(http, tokens, Settings(), clock, logger);
        Assert.IsFalse(await sender.SendAsync(Request(), CancellationToken.None));
        Assert.HasCount(2, stub.Requests);
        CollectionAssert.AreEqual(new[] { "Contact email unavailable (gmail-unauthorized)" }, logger.Messages);

        stub.GmailStatus = HttpStatusCode.OK;
        stub.OAuthResponse = "{\"access_token\":\"renewed\",\"expires_in\":3600,\"token_type\":\"Bearer\"}";
        Assert.IsTrue(await sender.SendAsync(Request(), CancellationToken.None));
        var requests = stub.Requests.ToArray();
        Assert.HasCount(4, requests);
        Assert.AreEqual("https://oauth2.googleapis.com/token", requests[2].Url);
        Assert.AreEqual("Bearer renewed", requests[3].Authorization);
    }

    [TestMethod]
    public async Task DelayedUnauthorizedResponseCannotEvictANewerCachedToken()
    {
        using var stub = new GmailHttpStub();
        using var tokens = new GmailTokenProvider(stub, Settings(), new EmailTestClock());
        var old = await tokens.GetTokenAsync(CancellationToken.None);
        await tokens.InvalidateAsync(old, CancellationToken.None);
        stub.OAuthResponse = "{\"access_token\":\"renewed\",\"expires_in\":3600,\"token_type\":\"Bearer\"}";
        Assert.AreEqual("renewed", await tokens.GetTokenAsync(CancellationToken.None));
        await tokens.InvalidateAsync(old, CancellationToken.None);
        Assert.AreEqual("renewed", await tokens.GetTokenAsync(CancellationToken.None));
        Assert.HasCount(2, stub.Requests);
    }

    [TestMethod]
    public void SettingsFailAtStartupWithoutLeakingSecrets()
    {
        foreach (var json in new[] { "{secret-data", "null", "{}", "{\"client_id\":\"secret-data\"}" })
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                ["ContactEmail:From"] = "noreply@scpp.nl", ["ContactEmail:FoundationTo"] = "stichting@scpp.nl", ["ContactEmail:AssociationTo"] = "info@scpp.nl", ["CONTACT_GMAIL_OAUTH_JSON"] = json
            }).Build();
            var exception = Assert.Throws<InvalidOperationException>(() => ContactEmailConfiguration.Load(config));
            Assert.IsFalse(exception.ToString().Contains("secret-data"));
        }
    }

    [TestMethod]
    public void SettingsValidateEveryMailboxAndRequireAllCredentialFields()
    {
        var values = new Dictionary<string, string?> {
            ["ContactEmail:From"] = "noreply@scpp.nl",
            ["ContactEmail:FoundationTo"] = "stichting@scpp.nl",
            ["ContactEmail:AssociationTo"] = "info@scpp.nl",
            ["CONTACT_GMAIL_OAUTH_JSON"] = "{\"client_id\":\"client\",\"client_secret\":\"secret\",\"refresh_token\":\"refresh\"}"
        };
        var valid = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        Assert.AreEqual("stichting@scpp.nl", ContactEmailConfiguration.Load(valid).Recipient("foundation"));
        Assert.AreEqual("info@scpp.nl", ContactEmailConfiguration.Load(valid).Recipient("association"));
        foreach (var key in values.Keys)
        {
            var missing = new Dictionary<string, string?>(values) { [key] = null };
            Assert.Throws<InvalidOperationException>(() => ContactEmailConfiguration.Load(
                new ConfigurationBuilder().AddInMemoryCollection(missing).Build()));
        }
        Assert.Throws<ArgumentException>(() => Settings().Recipient("unknown"));
    }

    [TestMethod]
    public async Task FailureLogsNeverIncludeProviderBodiesCredentialsOrContactFields()
    {
        using var stub = new GmailHttpStub { GmailStatus = HttpStatusCode.Forbidden, GmailResponse = "private provider body" };
        var clock = new EmailTestClock();
        using var tokens = new GmailTokenProvider(stub, Settings(), clock);
        using var http = stub.CreateClient("");
        var logger = new EmailLogRecorder();
        var sender = new GmailContactEmailSender(http, tokens, Settings(), clock, logger);
        Assert.IsFalse(await sender.SendAsync(Request(), CancellationToken.None));
        CollectionAssert.AreEqual(new[] { "Contact email unavailable (gmail-rejected)" }, logger.Messages);
    }

    private static async Task<bool> SendAsync(GmailHttpStub stub, CancellationToken cancellationToken = default)
    {
        var clock = new EmailTestClock();
        using var tokens = new GmailTokenProvider(stub, Settings(), clock);
        using var client = stub.CreateClient("");
        return await new GmailContactEmailSender(client, tokens, Settings(), clock, NullLogger<GmailContactEmailSender>.Instance)
            .SendAsync(Request(), cancellationToken);
    }
}
