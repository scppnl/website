using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Scpp.Foundation.Auth.Api.Access;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Sessions;

namespace Scpp.Foundation.Auth.Api.Google;

/// <summary>
/// Validates a Google ID token: RS256 signature from Google's cached JWKS (a refresh is requested for an
/// unknown key id), issuer, audience, authorized party, expiry, issue time and nonce.
/// </summary>
internal sealed class GoogleIdTokenValidator(
    IConfigurationManager<OpenIdConnectConfiguration> configurationManager,
    AuthSettings settings,
    TimeProvider clock)
{
    private static readonly TimeSpan ClockSkew = TimeSpan.FromMinutes(1);
    private static readonly string[] Issuers = ["https://accounts.google.com", "accounts.google.com"];
    private static readonly string[] Algorithms = [SecurityAlgorithms.RsaSha256];
    private readonly JsonWebTokenHandler handler = new();

    internal async Task<IdTokenValidationResult> ValidateAsync(string idToken, string expectedNonce, CancellationToken cancellationToken)
    {
        var result = await ValidateSignatureAsync(idToken, cancellationToken);
        if (!result.IsValid || result.SecurityToken is not JsonWebToken token) {
            return IdTokenValidationResult.Invalid;
        }

        var now = clock.GetUtcNow().UtcDateTime;
        if (token.IssuedAt == DateTime.MinValue || token.ValidTo + ClockSkew < now || token.IssuedAt - ClockSkew > now ||
            !token.TryGetPayloadValue<string>("nonce", out var nonce) || !FixedTimeString.AreEqual(nonce, expectedNonce) ||
            token.TryGetPayloadValue<string>("azp", out var authorizedParty) && authorizedParty != settings.ClientId ||
            !token.TryGetPayloadValue<string>("sub", out var subject) || string.IsNullOrEmpty(subject) ||
            !token.TryGetPayloadValue<string>("email", out var email) || string.IsNullOrEmpty(email)) {
            return IdTokenValidationResult.Invalid;
        }

        token.TryGetPayloadValue<string>("hd", out var hostedDomain);
        token.TryGetPayloadValue<string>("name", out var name);
        return new(new GoogleIdentity
        {
            Subject = subject,
            Email = email,
            EmailVerified = IsEmailVerified(token),
            HostedDomain = hostedDomain,
            Name = string.IsNullOrWhiteSpace(name) ? null : name,
        });
    }

    private async Task<TokenValidationResult> ValidateSignatureAsync(string idToken, CancellationToken cancellationToken)
    {
        var result = await ValidateAgainstAsync(idToken, cancellationToken);
        if (!result.IsValid && result.Exception is SecurityTokenSignatureKeyNotFoundException) {
            // Google rotates its signing keys; refresh once for an unknown key id.
            configurationManager.RequestRefresh();
            result = await ValidateAgainstAsync(idToken, cancellationToken);
        }

        return result;
    }

    private async Task<TokenValidationResult> ValidateAgainstAsync(string idToken, CancellationToken cancellationToken)
    {
        OpenIdConnectConfiguration configuration;
        try {
            configuration = await configurationManager.GetConfigurationAsync(cancellationToken);
        } catch (Exception exception) when (exception is InvalidOperationException or HttpRequestException or IOException ||
            exception is TaskCanceledException && !cancellationToken.IsCancellationRequested) {
            throw new GoogleUnavailableException(GoogleFailureCategory.Network, exception);
        }

        return await handler.ValidateTokenAsync(idToken, new TokenValidationParameters
        {
            ValidIssuers = Issuers,
            ValidAudience = settings.ClientId,
            ValidAlgorithms = Algorithms,
            IssuerSigningKeys = configuration.SigningKeys,
            TryAllIssuerSigningKeys = false,
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            ValidateLifetime = false,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
        });
    }

    private static bool IsEmailVerified(JsonWebToken token) =>
        token.TryGetPayloadValue<bool>("email_verified", out var verified) && verified ||
        token.TryGetPayloadValue<string>("email_verified", out var text) && text == "true";
}
