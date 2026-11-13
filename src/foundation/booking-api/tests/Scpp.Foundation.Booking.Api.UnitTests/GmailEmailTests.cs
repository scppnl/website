using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Foundation.Booking.Api.Configuration;
using Scpp.Foundation.Booking.Api.Email;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.UnitTests;

[TestClass]
public sealed class GmailEmailTests
{
    private static BookingEmailSettings Settings() => new("noreply@scpp.nl", "verhuur@scpp.nl",
        new() { ClientId = "client+id", ClientSecret = "secret&", RefreshToken = "refresh/" });

    private static BookingRequestDto Request() => new() {
        Name = "José Jansen", Email = "renter@example.org", Organisation = "Groep & co", Phone = "0123456789",
        Building = "beide", GroupType = "family", Date = new(2027, 6, 5), Dayparts = ["middag", "ochtend"],
        Guests = 30, Remarks = "Eén vraag:\nKunnen wij koffie zetten?\nBcc: nobody@example.org", TurnstileToken = "private-token"
    };

    [TestMethod]
    public async Task SendsCompleteMimeMessageWithFixedRecipientsAndSafeReplyTo()
    {
        using var stub = new GmailHttpStub();
        var clock = new EmailTestClock();
        using var tokens = new GmailTokenProvider(stub, Settings(), clock);
        using var http = stub.CreateClient("");
        var sender = new GmailBookingEmailSender(http, tokens, Settings(), clock, NullLogger<GmailBookingEmailSender>.Instance);
        Assert.IsTrue(await sender.Send(Request(), CancellationToken.None));
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
        StringAssert.Contains(parts[0], "From: noreply@scpp.nl\r\nTo: verhuur@scpp.nl\r\nReply-To: renter@example.org");
        StringAssert.Contains(parts[0], "Content-Type: text/plain; charset=utf-8");
        Assert.IsFalse(parts[0].Contains("Bcc:"));
        var subject = parts[0].Split("Subject: =?utf-8?B?")[1].Split("?=")[0];
        Assert.AreEqual("Nieuwe verhuuraanvraag – 05-06-2027", Encoding.UTF8.GetString(Convert.FromBase64String(subject)));
        var body = Encoding.UTF8.GetString(Convert.FromBase64String(parts[1]));
        foreach (var value in new[] { "José Jansen", "Groep & co", "0123456789", "renter@example.org", "Beide gebouwen",
            "Gezin of familie", "05-06-2027", "ochtend, middag", "30", "Eén vraag:\r\nKunnen wij koffie zetten?", "moet nog worden bevestigd" })
            StringAssert.Contains(body, value);
        Assert.IsFalse(mime.Contains("private-token"));
        Assert.IsFalse(body.Contains("private-token"));
    }

    [TestMethod]
    public void OptionalFieldsAndSingleDaypartAreReadable()
    {
        var raw = BookingEmailMessage.Create(new() { Name = "Test", Email = "a@example.org", Building = "terrein",
            GroupType = "other", Date = new(2027, 6, 5), Dayparts = ["avond"], Guests = 1 }, Settings(), DateTimeOffset.UtcNow);
        var encoded = raw.Replace('-', '+').Replace('_', '/');
        var mime = Encoding.UTF8.GetString(Convert.FromBase64String(encoded.PadRight((encoded.Length + 3) / 4 * 4, '=')));
        var body = Encoding.UTF8.GetString(Convert.FromBase64String(mime.Split("\r\n\r\n", 2)[1]));
        StringAssert.Contains(body, "Organisatie: Niet opgegeven");
        StringAssert.Contains(body, "Telefoon: Niet opgegeven");
        StringAssert.Contains(body, "Alleen buitenterrein");
        StringAssert.Contains(body, "Dagdelen: avond");
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
        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => tokens.GetToken(CancellationToken.None)));
        Assert.HasCount(1, stub.Requests);
        clock.Now = clock.Now.AddSeconds(3541);
        await tokens.GetToken(CancellationToken.None);
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
        Assert.IsFalse(await Send(stub));
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
        Assert.IsFalse(await Send(stub));
    }

    [TestMethod]
    public async Task NetworkErrorsAndProviderTimeoutsFailWhileCallerCancellationPropagates()
    {
        using var stub = new GmailHttpStub();
        stub.Respond = (_, _) => throw new HttpRequestException("must not be exposed");
        Assert.IsFalse(await Send(stub));
        stub.Respond = (_, _) => throw new TaskCanceledException("provider timeout");
        Assert.IsFalse(await Send(stub));
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        stub.Respond = async (_, token) => {
            entered.SetResult();
            await Task.Delay(Timeout.Infinite, token);
            return new(HttpStatusCode.OK);
        };
        using var cancellation = new CancellationTokenSource();
        var sending = Send(stub, cancellation.Token);
        await entered.Task;
        cancellation.Cancel();
        await Assert.ThrowsAsync<OperationCanceledException>(() => sending);
    }

    [TestMethod]
    [DataRow("a@example.org\r\nBcc: victim@example.org")]
    [DataRow("a@example.org,b@example.org")]
    [DataRow("Name<a@example.org>")]
    [DataRow("a@example.org\n")]
    public void UnsafeReplyAddressesAreRejected(string address) => Assert.IsFalse(BookingEmailSettings.IsMailbox(address));

    [TestMethod]
    public void SettingsFailAtStartupWithoutLeakingSecrets()
    {
        foreach (var json in new[] { "{secret-data", "null", "{}", "{\"client_id\":\"secret-data\"}" })
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                ["BookingEmail:From"] = "noreply@scpp.nl", ["BookingEmail:To"] = "verhuur@scpp.nl", ["BOOKING_GMAIL_OAUTH_JSON"] = json
            }).Build();
            var exception = Assert.Throws<InvalidOperationException>(() => BookingEmailSettings.Load(config));
            Assert.IsFalse(exception.ToString().Contains("secret-data"));
        }
    }

    [TestMethod]
    public async Task FailureLogsNeverIncludeProviderBodiesCredentialsOrBookingFields()
    {
        using var stub = new GmailHttpStub { GmailStatus = HttpStatusCode.Forbidden, GmailResponse = "private provider body" };
        var clock = new EmailTestClock();
        using var tokens = new GmailTokenProvider(stub, Settings(), clock);
        using var http = stub.CreateClient("");
        var logger = new EmailLogRecorder();
        var sender = new GmailBookingEmailSender(http, tokens, Settings(), clock, logger);
        Assert.IsFalse(await sender.Send(Request(), CancellationToken.None));
        CollectionAssert.AreEqual(new[] { "Booking email unavailable (gmail-rejected)" }, logger.Messages);
    }

    private static async Task<bool> Send(GmailHttpStub stub, CancellationToken cancellationToken = default)
    {
        var clock = new EmailTestClock();
        using var tokens = new GmailTokenProvider(stub, Settings(), clock);
        using var client = stub.CreateClient("");
        return await new GmailBookingEmailSender(client, tokens, Settings(), clock, NullLogger<GmailBookingEmailSender>.Instance)
            .Send(Request(), cancellationToken);
    }
}
