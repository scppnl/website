using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Scpp.Foundation.Auth.Api.Access;
using Scpp.Foundation.Auth.Api.Serialization;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Contracts;

namespace Scpp.Foundation.Auth.Api.Endpoints;

/// <summary>Reports the signed-in user, re-applying the domain rules so config changes take effect.</summary>
internal sealed class SessionEndpoint(CookieProtector protector, AccessPolicy policy, TimeProvider clock)
{
    internal Results<Ok<SessionResponseDto>, UnauthorizedHttpResult> Get(HttpContext context)
    {
        var session = ReadSession(context.Request);
        if (session is null || clock.GetUtcNow().ToUnixTimeSeconds() >= session.ExpiresAt ||
            session.Version != GoogleCallbackEndpoint.SessionVersion ||
            policy.Evaluate(session.HostedDomain, session.Email) != AccessDecision.Allowed) {
            return TypedResults.Unauthorized();
        }

        return TypedResults.Ok(new SessionResponseDto
        {
            Email = session.Email,
            ExpiresAt = DateTimeOffset.FromUnixTimeSeconds(session.ExpiresAt),
        });
    }

    private SessionPayload? ReadSession(HttpRequest request)
    {
        var plaintext = protector.Unprotect(AuthCookies.Session, request.Cookies[AuthCookies.Session]);
        if (plaintext.IsEmpty) {
            return null;
        }

        try {
            return JsonSerializer.Deserialize(plaintext.Span, AuthJsonContext.Default.SessionPayload);
        } catch (JsonException) {
            return null;
        }
    }
}
