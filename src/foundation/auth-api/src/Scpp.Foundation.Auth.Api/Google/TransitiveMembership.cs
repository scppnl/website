using System.Text.Json.Serialization;

namespace Scpp.Foundation.Auth.Api.Google;

/// <summary>One group the searched member belongs to, directly or through nested groups.</summary>
internal sealed class TransitiveMembership
{
    [JsonPropertyName("groupKey")]
    public EntityKey? GroupKey { get; init; }
}
