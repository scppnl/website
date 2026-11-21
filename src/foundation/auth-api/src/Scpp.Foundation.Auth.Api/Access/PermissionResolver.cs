using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Google;

namespace Scpp.Foundation.Auth.Api.Access;

/// <summary>
/// Turns a user's Workspace security groups into the permissions configured in <c>Auth:Permissions</c>.
/// Without any configured permission it never calls Google.
/// </summary>
/// <exception cref="GoogleUnavailableException">
/// Both methods throw it when the groups could not be determined; callers must not grant anything then.
/// </exception>
internal sealed class PermissionResolver(AuthSettings settings, GroupMembershipCache cache, GoogleGroupsClient groups)
{
    /// <summary>The permissions of the user, from a lookup that is at most <see cref="GroupMembershipCache.Lifetime"/> old.</summary>
    internal async Task<IReadOnlyList<string>> ResolveAsync(string email, CancellationToken cancellationToken)
    {
        if (settings.Permissions.Count == 0) {
            return [];
        }

        return cache.TryGet(email, out var memberOf)
            ? Map(memberOf)
            : await RefreshAsync(email, cancellationToken);
    }

    /// <summary>Always asks Google, so a new session starts from the current memberships.</summary>
    internal async Task<IReadOnlyList<string>> RefreshAsync(string email, CancellationToken cancellationToken)
    {
        if (settings.Permissions.Count == 0) {
            return [];
        }

        var memberOf = await groups.GetSecurityGroupsAsync(email, cancellationToken);
        cache.Set(email, memberOf);
        return Map(memberOf);
    }

    private string[] Map(IReadOnlySet<string> memberOf) =>
        settings.Permissions
            .Where(rule => rule.Groups.Overlaps(memberOf))
            .Select(rule => rule.Name)
            .Order(StringComparer.Ordinal)
            .ToArray();
}
