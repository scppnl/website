using Microsoft.IdentityModel.Tokens;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

/// <summary>The content of a test ID token. Defaults describe a valid sign-in by an allowed account.</summary>
public sealed record IdTokenClaims
{
    public string Subject { get; init; } = "1234567890";
    public string Email { get; init; } = "member@scpp.nl";
    public bool EmailVerified { get; init; } = true;
    public string? HostedDomain { get; init; } = "scpp.nl";

    /// <summary>Null means: the nonce of the sign-in attempt.</summary>
    public string? Nonce { get; init; }
    public string Issuer { get; init; } = "https://accounts.google.com";
    public string Audience { get; init; } = AuthTestHost.ClientId;
    public string? AuthorizedParty { get; init; }

    /// <summary>Null means: one hour after the test clock.</summary>
    public DateTimeOffset? ExpiresAt { get; init; }

    /// <summary>Null means: the test clock.</summary>
    public DateTimeOffset? IssuedAt { get; init; }

    /// <summary>Leaves the iat claim out of the token.</summary>
    public bool OmitIssuedAt { get; init; }
    public string Algorithm { get; init; } = SecurityAlgorithms.RsaSha256;
    public TestSigningKey SigningKey { get; init; } = TestSigningKey.Primary;
}
