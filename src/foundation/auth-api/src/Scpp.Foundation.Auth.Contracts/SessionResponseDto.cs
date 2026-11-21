namespace Scpp.Foundation.Auth.Contracts;

/// <summary>The signed-in user, as returned by <c>GET /auth/session</c>.</summary>
public sealed class SessionResponseDto
{
    public required string Email { get; init; }
    public string? Name { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
}
