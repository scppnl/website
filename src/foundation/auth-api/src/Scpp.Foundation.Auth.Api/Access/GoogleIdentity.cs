namespace Scpp.Foundation.Auth.Api.Access;

/// <summary>The claims of a validated Google ID token that the API uses.</summary>
internal sealed class GoogleIdentity
{
    public required string Subject { get; init; }
    public required string Email { get; init; }
    public required bool EmailVerified { get; init; }
    public string? HostedDomain { get; init; }
}
