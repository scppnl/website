using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;

namespace Scpp.Foundation.Auth.Api.Access;

/// <summary>
/// Remembers successful group lookups for a short time, so a removal from a group takes effect within
/// <see cref="Lifetime"/>. Failed lookups are never stored. The cache is per instance and in memory only.
/// </summary>
internal sealed class GroupMembershipCache(TimeProvider clock)
{
    internal static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    private readonly ConcurrentDictionary<string, GroupMembershipEntry> entries = new(StringComparer.OrdinalIgnoreCase);

    internal bool TryGet(string email, [NotNullWhen(true)] out IReadOnlySet<string>? groups)
    {
        groups = entries.TryGetValue(email, out var entry) && !IsExpired(entry) ? entry.Groups : null;
        return groups is not null;
    }

    internal void Set(string email, IReadOnlySet<string> groups)
    {
        foreach (var (key, entry) in entries) {
            if (IsExpired(entry)) {
                entries.TryRemove(key, out _);
            }
        }

        entries[email] = new(groups, clock.GetUtcNow());
    }

    private bool IsExpired(GroupMembershipEntry entry) => clock.GetUtcNow() - entry.FetchedAt >= Lifetime;
}
