using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Scpp.Foundation.Auth.Api.Serialization;

namespace Scpp.Foundation.Auth.Api.Google;

/// <summary>
/// Looks up which Workspace security groups a user belongs to, including through nested groups,
/// with the Cloud Identity Groups API. Answers it cannot trust are failures, never "no groups".
/// </summary>
internal sealed class GoogleGroupsClient(IHttpClientFactory clients, MetadataTokenSource tokens)
{
    // A safety limit: a user in this many groups is a misconfiguration, and the lookup fails closed.
    private const int MaxPages = 10;

    /// <summary>The lower-case addresses of the security groups the user is a member of.</summary>
    internal async Task<IReadOnlySet<string>> GetSecurityGroupsAsync(string email, CancellationToken cancellationToken)
    {
        var groups = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var accessToken = await tokens.GetAsync(cancellationToken);
        string? pageToken = null;
        for (var page = 0; page < MaxPages; page++) {
            var response = await GetPageAsync(email, accessToken, pageToken, cancellationToken);
            groups.UnionWith((response.Memberships ?? [])
                .Select(membership => membership.GroupKey?.Id)
                .OfType<string>()
                .Where(id => id.Length > 0)
                .Select(id => id.ToLowerInvariant()));
            pageToken = response.NextPageToken;
            if (string.IsNullOrEmpty(pageToken)) {
                return groups;
            }
        }

        throw new GoogleUnavailableException(GoogleFailureCategory.InvalidResponse);
    }

    private async Task<TransitiveGroupsResponse> GetPageAsync(
        string email, string accessToken, string? pageToken, CancellationToken cancellationToken)
    {
        var parameters = new Dictionary<string, string?> { ["query"] = Query(email), ["pageToken"] = pageToken };
        using var request = new HttpRequestMessage(HttpMethod.Get, QueryHelpers.AddQueryString(GoogleEndpoints.TransitiveGroups, parameters));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        try {
            using var client = clients.CreateClient(GoogleEndpoints.CloudClient);
            using var response = await client.SendAsync(request, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound) {
                return new();
            }

            if (!response.IsSuccessStatusCode) {
                throw new GoogleUnavailableException(GoogleFailureCategory.ProviderError);
            }

            return await response.Content.ReadFromJsonAsync(AuthJsonContext.Default.TransitiveGroupsResponse, cancellationToken)
                ?? throw new GoogleUnavailableException(GoogleFailureCategory.InvalidResponse);
        } catch (HttpRequestException exception) {
            throw new GoogleUnavailableException(GoogleFailureCategory.Network, exception);
        } catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested) {
            throw new GoogleUnavailableException(GoogleFailureCategory.Timeout, exception);
        } catch (JsonException exception) {
            throw new GoogleUnavailableException(GoogleFailureCategory.InvalidResponse, exception);
        }
    }

    /// <summary>The Cloud Identity query. The email is a string literal, so backslashes and quotes are escaped.</summary>
    private static string Query(string email) =>
        $"member_key_id == '{email.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("'", "\\'", StringComparison.Ordinal)}' " +
        $"&& '{GoogleEndpoints.SecurityGroupLabel}' in labels";
}
