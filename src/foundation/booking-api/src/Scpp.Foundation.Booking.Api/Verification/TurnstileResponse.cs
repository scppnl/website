using System.Text.Json.Serialization;

namespace Scpp.Foundation.Booking.Api.Verification;

internal sealed record TurnstileResponse(
    [property: JsonPropertyName("success")] bool? Success,
    [property: JsonPropertyName("hostname")] string? Hostname,
    [property: JsonPropertyName("action")] string? Action);
