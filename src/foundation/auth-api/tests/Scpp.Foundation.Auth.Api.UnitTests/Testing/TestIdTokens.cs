using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

internal static class TestIdTokens
{
    internal static string Create(IdTokenClaims claims, string attemptNonce, DateTimeOffset now)
    {
        var payload = new Dictionary<string, object>
        {
            ["sub"] = claims.Subject,
            ["email"] = claims.Email,
            ["email_verified"] = claims.EmailVerified,
            ["nonce"] = claims.Nonce ?? attemptNonce,
        };
        if (claims.HostedDomain is not null) {
            payload["hd"] = claims.HostedDomain;
        }

        if (claims.AuthorizedParty is not null) {
            payload["azp"] = claims.AuthorizedParty;
        }

        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = claims.Issuer,
            Audience = claims.Audience,
            Claims = payload,
            IssuedAt = (claims.IssuedAt ?? now).UtcDateTime,
            Expires = (claims.ExpiresAt ?? now.AddHours(1)).UtcDateTime,
            SigningCredentials = new SigningCredentials(claims.SigningKey.SecurityKey, claims.Algorithm),
        });
    }
}
