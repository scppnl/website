using System.Text.Json.Serialization;

namespace Scpp.Foundation.Auth.Api.Google;

internal sealed class MetadataTokenResponse
{
    [JsonPropertyName("access_token")]
    public string? AccessToken { get; init; }

    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; init; }
}
