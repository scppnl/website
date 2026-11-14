using System.Text.Json.Serialization;

namespace Scpp.Foundation.Booking.Api.Email;

internal sealed class GmailTokenResponse
{
    [JsonPropertyName("access_token")]
    public string? AccessToken { get; init; }
    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; init; }
    [JsonPropertyName("token_type")]
    public string? TokenType { get; init; }
}
