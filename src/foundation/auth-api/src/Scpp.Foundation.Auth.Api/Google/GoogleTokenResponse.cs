using System.Text.Json.Serialization;

namespace Scpp.Foundation.Auth.Api.Google;

internal sealed class GoogleTokenResponse
{
    [JsonPropertyName("id_token")]
    public string? IdToken { get; init; }
}
