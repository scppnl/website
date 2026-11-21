using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Scpp.Foundation.Auth.Api.Access;
using Scpp.Foundation.Auth.Api.Google;
using Scpp.Foundation.Auth.Api.Serialization;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Contracts;

namespace Scpp.Foundation.Auth.Api.Endpoints;

/// <summary>
/// Reports the signed-in user, re-applying the domain rules and the group-based permissions so
/// configuration and membership changes take effect.
/// </summary>
internal sealed class SessionEndpoint(
    CookieProtector protector,
    AccessPolicy policy,
    PermissionResolver permissions,
    TimeProvider clock,
    ILogger<SessionEndpoint> logger)
{
    internal async Task<Results<Ok<SessionResponseDto>, UnauthorizedHttpResult, ContentHttpResult>> GetAsync(
        HttpContext context, CancellationToken cancellationToken)
    {
        var session = ReadSession(context.Request);
        if (session is null || clock.GetUtcNow().ToUnixTimeSeconds() >= session.ExpiresAt ||
            session.Version != GoogleCallbackEndpoint.SessionVersion ||
            policy.Evaluate(session.HostedDomain, session.Email) != AccessDecision.Allowed) {
            return TypedResults.Unauthorized();
        }

        try {
            return TypedResults.Ok(new SessionResponseDto
            {
                Email = session.Email,
                Name = session.Name,
                ExpiresAt = DateTimeOffset.FromUnixTimeSeconds(session.ExpiresAt),
                Permissions = await permissions.ResolveAsync(session.Email, cancellationToken),
            });
        } catch (GoogleUnavailableException exception) {
            // Fail closed: without a trustworthy answer nobody is told which permissions they hold.
            logger.LogWarning(exception, "Session permissions lookup failed with {FailureCategory}", exception.Category);
            return TypedResults.Text("Permissions are temporarily unavailable. Please try again.", "text/plain",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
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
