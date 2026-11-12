using System.Net;
using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Scpp.Shared.Contact.Api.UnitTests;

internal sealed class SiteverifyStub : HttpMessageHandler
{
    internal int Calls;
    internal string? Url;
    internal string? Body;
    internal string Response = "{\"success\":true,\"hostname\":\"scpp.nl\",\"action\":\"contact\"}";
    internal HttpStatusCode Status = HttpStatusCode.OK;
    internal Func<CancellationToken, Task<HttpResponseMessage>>? Respond;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        Url = request.RequestUri!.ToString();
        Body = await request.Content!.ReadAsStringAsync(cancellationToken);
        return Respond is not null ? await Respond(cancellationToken) :
            new HttpResponseMessage(Status) { Content = new StringContent(Response, Encoding.UTF8, "application/json") };
    }
}

[TestClass]
public sealed class TurnstileTests
{
    [TestMethod]
    public async Task TimeoutAndNetworkErrorsFailClosed()
    {
        foreach (var network in new[] { true, false })
        {
            using var stub = new SiteverifyStub
            {
                Respond = async token => {
                    if (network) throw new HttpRequestException("network");
                    await Task.Delay(Timeout.Infinite, token);
                    return new(HttpStatusCode.OK);
                }
            };
            using var client = new HttpClient(stub) { Timeout = TimeSpan.FromMilliseconds(25) };
            var verifier = new TurnstileVerifier(client, new("secret", ["scpp.nl"]));
            Assert.AreEqual(VerificationOutcome.Unavailable, await verifier.Verify("token", CancellationToken.None));
        }
    }

    [TestMethod]
    public async Task RequestCancellationPropagatesToProvider()
    {
        using var stub = new SiteverifyStub { Respond = async token => {
            await Task.Delay(Timeout.Infinite, token);
            return new(HttpStatusCode.OK);
        } };
        using var client = new HttpClient(stub);
        using var cancellation = new CancellationTokenSource(25);
        var verifier = new TurnstileVerifier(client, new("secret", ["scpp.nl"]));
        await Assert.ThrowsAsync<OperationCanceledException>(() => verifier.Verify("token", cancellation.Token));
    }

    [TestMethod]
    public void StartupRejectsMissingSettingsAndUnsafeProductionSettings()
    {
        foreach (var (secret, host) in new[] {
            ("", "scpp.nl"), ("secret", ""), ("secret", "localhost"),
            ("secret", "127.0.0.1"), ("secret", "*.scpp.nl"),
            ("1x0000000000000000000000000000000AA", "scpp.nl")
        })
        {
            Assert.Throws<InvalidOperationException>(() => ContactApi.Build([
                "--environment", "Production", "--CONTACT_TURNSTILE_SECRET_KEY", secret,
                "--Turnstile:AllowedHostnames:0", host]));
        }
    }
}
