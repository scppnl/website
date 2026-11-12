using System.Text.Json;
using System.Text.Json.Serialization;

namespace Scpp.Shared.Contact.Api;

internal sealed record TurnstileSettings(string SecretKey, HashSet<string> AllowedHostnames)
{
    internal static TurnstileSettings Load(IConfiguration configuration, IHostEnvironment environment)
    {
        var secret = configuration["Turnstile:SecretKey"];
        var hostnames = configuration.GetSection("Turnstile:AllowedHostnames").GetChildren()
            .Select(child => child.Value ?? "").ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(secret) || hostnames.Count == 0 ||
            hostnames.Any(host => Uri.CheckHostName(host) == UriHostNameType.Unknown || host.Contains('*')) ||
            (!environment.IsDevelopment() &&
                (secret is "1x0000000000000000000000000000000AA" or "2x0000000000000000000000000000000AA" or "3x0000000000000000000000000000000AA" ||
                 hostnames.Any(host => host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                     System.Net.IPAddress.TryParse(host, out var address) && System.Net.IPAddress.IsLoopback(address)))))
            throw new InvalidOperationException("Configure Turnstile:SecretKey and Turnstile:AllowedHostnames. Production must not use test secrets or loopback hostnames.");
        return new(secret, hostnames);
    }
}

internal enum VerificationOutcome { Accepted, Rejected, Unavailable }

internal sealed record TurnstileResponse(
    [property: JsonPropertyName("success")] bool? Success,
    [property: JsonPropertyName("hostname")] string? Hostname,
    [property: JsonPropertyName("action")] string? Action);

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
            var result = await response.Content.ReadFromJsonAsync(ContactJsonContext.Default.TurnstileResponse, cancellationToken);
            if (result?.Success is null) return VerificationOutcome.Unavailable;
            return result.Success == true && result.Action == "contact" && result.Hostname is not null &&
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
