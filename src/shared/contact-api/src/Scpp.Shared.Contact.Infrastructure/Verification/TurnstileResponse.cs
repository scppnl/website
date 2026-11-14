using System.Text.Json.Serialization;

namespace Scpp.Shared.Contact.Infrastructure.Verification;

internal sealed record TurnstileResponse
{
    [JsonPropertyName("success")]
    public bool? Success { get; init; }
    [JsonPropertyName("hostname")]
    public string? Hostname { get; init; }
    [JsonPropertyName("action")]
    public string? Action { get; init; }
}
