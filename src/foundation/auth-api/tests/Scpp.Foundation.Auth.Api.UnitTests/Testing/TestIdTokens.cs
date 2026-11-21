using System.Text.Json;
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

        if (claims.Name is not null) {
            payload["name"] = claims.Name;
        }

        if (claims.AuthorizedParty is not null) {
            payload["azp"] = claims.AuthorizedParty;
        }

        var handler = new JsonWebTokenHandler();
        if (claims.OmitIssuedAt) {
            // CreateToken(descriptor) adds iat on its own, so build the payload by hand.
            payload["iss"] = claims.Issuer;
            payload["aud"] = claims.Audience;
            payload["exp"] = (claims.ExpiresAt ?? now.AddHours(1)).ToUnixTimeSeconds();
            return handler.CreateToken(JsonSerializer.Serialize(payload), new SigningCredentials(claims.SigningKey.SecurityKey, claims.Algorithm));
        }

        return handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = claims.Issuer,
            Audience = claims.Audience,
            Claims = payload,
            IssuedAt = claims.OmitIssuedAt ? null : (claims.IssuedAt ?? now).UtcDateTime,
            Expires = (claims.ExpiresAt ?? now.AddHours(1)).UtcDateTime,
            SigningCredentials = new SigningCredentials(claims.SigningKey.SecurityKey, claims.Algorithm),
        });
    }
}
