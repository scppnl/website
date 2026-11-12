using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Scpp.Shared.Contact.Infrastructure.Verification;
using Scpp.Shared.Contact.Api.UnitTests.Testing;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Scpp.Shared.Contact.Api.UnitTests.Verification;

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
            var verifier = new TurnstileVerifier(client, new("secret", ["scpp.nl"]), NullLogger<TurnstileVerifier>.Instance);
            Assert.AreEqual(TurnstileVerificationOutcome.Unavailable, await verifier.VerifyAsync("token", "test-trace", CancellationToken.None));
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
        var verifier = new TurnstileVerifier(client, new("secret", ["scpp.nl"]), NullLogger<TurnstileVerifier>.Instance);
        await Assert.ThrowsAsync<OperationCanceledException>(() => verifier.VerifyAsync("token", "test-trace", cancellation.Token));
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
