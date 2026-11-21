using System.Text.Json.Serialization;

namespace Scpp.Foundation.Auth.Api.Google;

internal sealed class EntityKey
{
    [JsonPropertyName("id")]
    public string? Id { get; init; }
}
