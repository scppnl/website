using System.Text.Json.Serialization;

namespace Scpp.Foundation.Auth.Api.Google;

/// <summary>One page of the Cloud Identity <c>memberships:searchTransitiveGroups</c> answer.</summary>
internal sealed class TransitiveGroupsResponse
{
    [JsonPropertyName("memberships")]
    public List<TransitiveMembership>? Memberships { get; init; }

    [JsonPropertyName("nextPageToken")]
    public string? NextPageToken { get; init; }
}
