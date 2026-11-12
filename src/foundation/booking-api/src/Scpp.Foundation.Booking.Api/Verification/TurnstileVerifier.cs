using System.Text.Json;
using Scpp.Foundation.Booking.Api.Configuration;
using Scpp.Foundation.Booking.Api.Serialization;

namespace Scpp.Foundation.Booking.Api.Verification;

internal sealed class TurnstileVerifier(HttpClient client, TurnstileSettings settings)
{
    internal async Task<VerificationOutcome> Verify(string token, CancellationToken cancellationToken)
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
            if (!response.IsSuccessStatusCode) return VerificationOutcome.Unavailable;
            var result = await response.Content.ReadFromJsonAsync(BookingJsonContext.Default.TurnstileResponse, cancellationToken);
            if (result?.Success is null) return VerificationOutcome.Unavailable;
            return result.Success == true && result.Action == "booking" && result.Hostname is not null &&
                settings.AllowedHostnames.Contains(result.Hostname)
                ? VerificationOutcome.Accepted : VerificationOutcome.Rejected;
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException ||
            exception is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            return VerificationOutcome.Unavailable;
        }
    }
}
