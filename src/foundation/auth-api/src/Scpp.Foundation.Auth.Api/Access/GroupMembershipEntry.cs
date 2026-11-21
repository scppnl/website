namespace Scpp.Foundation.Auth.Api.Access;

/// <summary>The groups found for one user and when they were looked up.</summary>
internal sealed record GroupMembershipEntry(IReadOnlySet<string> Groups, DateTimeOffset FetchedAt);
