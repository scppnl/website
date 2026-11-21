using System.Collections.Concurrent;
using System.Net;
using Microsoft.AspNetCore.WebUtilities;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

/// <summary>Stands in for Google's discovery document, JWKS and token endpoint. Nothing leaves the process.</summary>
internal sealed class GoogleHttpStub : HttpMessageHandler
{
    internal ConcurrentQueue<Dictionary<string, string>> TokenRequests { get; } = new();
    internal string IdToken { get; set; } = "";
    internal HttpStatusCode TokenStatus { get; set; } = HttpStatusCode.OK;
    internal string? TokenBody { get; set; }
    internal Exception? TokenFailure { get; set; }
    internal HttpStatusCode DiscoveryStatus { get; set; } = HttpStatusCode.OK;

    /// <summary>Requests to the metadata server's token endpoint.</summary>
    internal ConcurrentQueue<RecordedRequest> MetadataRequests { get; } = new();
    internal HttpStatusCode MetadataStatus { get; set; } = HttpStatusCode.OK;
    internal int MetadataExpiresIn { get; set; } = 3600;

    /// <summary>Requests to the Cloud Identity <c>searchTransitiveGroups</c> endpoint.</summary>
    internal ConcurrentQueue<RecordedRequest> GroupRequests { get; } = new();
    internal HttpStatusCode GroupsStatus { get; set; } = HttpStatusCode.OK;
    internal Exception? GroupsFailure { get; set; }

    /// <summary>The addresses of the groups the signed-in user belongs to.</summary>
    internal IReadOnlyList<string> Groups { get; set; } = [];

    /// <summary>How many groups one page holds; 0 puts everything on one page.</summary>
    internal int GroupsPageSize { get; set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var uri = request.RequestUri!;
        if (uri is { Host: "oauth2.googleapis.com", AbsolutePath: "/token" }) {
            var form = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(cancellationToken));
            TokenRequests.Enqueue(form.ToDictionary(pair => pair.Key, pair => pair.Value.ToString()));
            return TokenFailure is not null
                ? throw TokenFailure
                : Json(TokenStatus, TokenBody ?? $"{{\"access_token\":\"unused\",\"token_type\":\"Bearer\",\"id_token\":\"{IdToken}\"}}");
        }

        if (uri is { Host: "metadata.google.internal", AbsolutePath: "/computeMetadata/v1/instance/service-accounts/default/token" }) {
            MetadataRequests.Enqueue(Record(request));
            return Json(MetadataStatus, $"{{\"access_token\":\"test-access-token\",\"expires_in\":{MetadataExpiresIn},\"token_type\":\"Bearer\"}}");
        }

        if (uri is { Host: "cloudidentity.googleapis.com", AbsolutePath: "/v1/groups/-/memberships:searchTransitiveGroups" }) {
            var recorded = Record(request);
            GroupRequests.Enqueue(recorded);
            return GroupsFailure is not null ? throw GroupsFailure : Json(GroupsStatus, GroupsPage(recorded.PageToken));
        }

        if (uri is { Host: "accounts.google.com", AbsolutePath: "/.well-known/openid-configuration" }) {
            return Json(DiscoveryStatus, "{\"issuer\":\"https://accounts.google.com\"," +
                "\"authorization_endpoint\":\"https://accounts.google.com/o/oauth2/v2/auth\"," +
                "\"token_endpoint\":\"https://oauth2.googleapis.com/token\"," +
                "\"jwks_uri\":\"https://www.googleapis.com/oauth2/v3/certs\"," +
                "\"response_types_supported\":[\"code\"],\"subject_types_supported\":[\"public\"]," +
                "\"id_token_signing_alg_values_supported\":[\"RS256\"]}");
        }

        return uri is { Host: "www.googleapis.com", AbsolutePath: "/oauth2/v3/certs" }
            ? Json(HttpStatusCode.OK, $"{{\"keys\":[{TestSigningKey.Primary.Jwk}]}}")
            : new HttpResponseMessage(HttpStatusCode.NotFound);
    }

    private static RecordedRequest Record(HttpRequestMessage request)
    {
        var query = QueryHelpers.ParseQuery(request.RequestUri!.Query);
        return new(
            query.TryGetValue("query", out var searchQuery) ? searchQuery.ToString() : null,
            query.TryGetValue("pageToken", out var pageToken) ? pageToken.ToString() : null,
            query.TryGetValue("scopes", out var scopes) ? scopes.ToString() : null,
            request.Headers.Authorization?.ToString(),
            request.Headers.TryGetValues("Metadata-Flavor", out var flavor) ? flavor.Single() : null);
    }

    /// <summary>The page the given token asks for. A token is the index of the first group on that page.</summary>
    private string GroupsPage(string? pageToken)
    {
        var start = pageToken is null ? 0 : int.Parse(pageToken, System.Globalization.CultureInfo.InvariantCulture);
        var size = GroupsPageSize == 0 ? Groups.Count : GroupsPageSize;
        var page = Groups.Skip(start).Take(size).Select(address => $"{{\"groupKey\":{{\"id\":\"{address}\"}}}}");
        var next = start + size < Groups.Count ? $",\"nextPageToken\":\"{start + size}\"" : "";
        return $"{{\"memberships\":[{string.Join(',', page)}]{next}}}";
    }

    private static HttpResponseMessage Json(HttpStatusCode status, string body) =>
        new(status) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") };
}
