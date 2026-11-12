using System.Text.Json.Serialization;

namespace Scpp.Shared.Contact.Infrastructure.Verification;

internal sealed record TurnstileResponse(
    [property: JsonPropertyName("success")] bool? Success,
    [property: JsonPropertyName("hostname")] string? Hostname,
    [property: JsonPropertyName("action")] string? Action);
