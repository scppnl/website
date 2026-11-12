using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Scpp.Shared.Contact.Infrastructure.Serialization;

namespace Scpp.Shared.Contact.Infrastructure.Verification;

public sealed class TurnstileVerifier(
    HttpClient client, TurnstileSettings settings, ILogger<TurnstileVerifier> logger)
{
    public async Task<TurnstileVerificationOutcome> VerifyAsync(string token, string traceId, CancellationToken cancellationToken)
    {
        var outcome = await Verify(token, cancellationToken);
        logger.LogDebug("Contact verification outcome: {Outcome} ({TraceId})", outcome, traceId);
        return outcome;
    }

    private async Task<TurnstileVerificationOutcome> Verify(string token, CancellationToken cancellationToken)
    {
        try
        {
            using var body = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["secret"] = settings.SecretKey,
                ["response"] = token
            });
            using var response = await client.PostAsync(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify", body, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return TurnstileVerificationOutcome.Unavailable;
            }

            var result = await response.Content.ReadFromJsonAsync(TurnstileJsonContext.Default.TurnstileResponse, cancellationToken);
            if (result?.Success is null)
            {
                return TurnstileVerificationOutcome.Unavailable;
            }

            return result.Success == true && result.Action == "contact" && result.Hostname is not null &&
                settings.AllowedHostnames.Contains(result.Hostname)
                ? TurnstileVerificationOutcome.Accepted : TurnstileVerificationOutcome.Rejected;
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException ||
            exception is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            return TurnstileVerificationOutcome.Unavailable;
        }
    }
}
