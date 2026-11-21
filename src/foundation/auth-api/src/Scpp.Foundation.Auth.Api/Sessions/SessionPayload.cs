namespace Scpp.Foundation.Auth.Api.Sessions;

/// <summary>The signed-in user, kept in the encrypted session cookie.</summary>
internal sealed class SessionPayload
{
    public required int Version { get; init; }
    public required string Subject { get; init; }
    public required string Email { get; init; }
    public string? HostedDomain { get; init; }
    public required long IssuedAt { get; init; }
    public required long ExpiresAt { get; init; }
}
