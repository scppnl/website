namespace Scpp.Foundation.Auth.Api.Configuration;

/// <summary>A permission and the Workspace security groups whose members hold it.</summary>
internal sealed record PermissionRule(string Name, IReadOnlySet<string> Groups);
