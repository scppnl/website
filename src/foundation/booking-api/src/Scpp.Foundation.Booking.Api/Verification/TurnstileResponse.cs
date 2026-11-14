using System.Text.Json.Serialization;

namespace Scpp.Foundation.Booking.Api.Verification;

internal sealed record TurnstileResponse
{
    [JsonPropertyName("success")]
    public bool? Success { get; init; }
    [JsonPropertyName("hostname")]
    public string? Hostname { get; init; }
    [JsonPropertyName("action")]
    public string? Action { get; init; }
}
