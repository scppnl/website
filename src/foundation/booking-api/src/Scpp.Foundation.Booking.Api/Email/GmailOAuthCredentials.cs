using System.Text.Json.Serialization;

namespace Scpp.Foundation.Booking.Api.Email;

internal sealed class GmailOAuthCredentials
{
    [JsonPropertyName("client_id")]
    public string? ClientId { get; init; }
    [JsonPropertyName("client_secret")]
    public string? ClientSecret { get; init; }
    [JsonPropertyName("refresh_token")]
    public string? RefreshToken { get; init; }
}
