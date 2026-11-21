using System.Text.Json;
using Scpp.Foundation.Auth.Api.Access;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Google;
using Scpp.Foundation.Auth.Api.Logging;
using Scpp.Foundation.Auth.Api.Serialization;
using Scpp.Foundation.Auth.Api.Sessions;

namespace Scpp.Foundation.Auth.Api.Endpoints;

/// <summary>Finishes the flow: validates state, code and ID token, applies the domain rules and issues the session.</summary>
internal sealed class GoogleCallbackEndpoint(
    AuthSettings settings,
    CookieProtector protector,
    GoogleOidcClient google,
    GoogleIdTokenValidator validator,
    AccessPolicy policy,
    TimeProvider clock,
    ILogger<GoogleCallbackEndpoint> logger)
{
    internal const int SessionVersion = 1;
    internal static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(8);

    internal async Task<IResult> GetAsync(HttpContext context, CancellationToken cancellationToken)
    {
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        var flow = ReadFlow(context.Request);
        AuthCookies.Clear(context.Response, AuthCookies.Flow);

        var (outcome, identity) = await ResolveAsync(context.Request.Query, flow, cancellationToken);
        if (outcome == SignInOutcome.Success) {
            logger.LogInformation("Google sign-in finished with {Outcome}", outcome);
            IssueSession(context.Response, identity!);
            return TypedResults.Redirect(settings.FrontendUri(settings.PostSignInPath).AbsoluteUri);
        }

        logger.LogWarning("Google sign-in finished with {Outcome}", outcome);
        AuthCookies.Clear(context.Response, AuthCookies.Session);
        return outcome switch
        {
            SignInOutcome.ProviderUnavailable =>
                TypedResults.Text("Sign-in is temporarily unavailable. Please try again.", "text/plain", statusCode: StatusCodes.Status503ServiceUnavailable),
            SignInOutcome.WrongDomain or SignInOutcome.NotAuthorized or SignInOutcome.EmailUnverified =>
                TypedResults.Redirect(settings.FrontendUri(AuthSettings.AccessDeniedPath).AbsoluteUri),
            _ => TypedResults.Redirect(settings.FrontendUri(AuthSettings.SignInPath).AbsoluteUri),
        };
    }

    private async Task<(SignInOutcome Outcome, GoogleIdentity? Identity)> ResolveAsync(
        IQueryCollection query, FlowPayload? flow, CancellationToken cancellationToken)
    {
        if (query.ContainsKey("error")) {
            return (SignInOutcome.Cancelled, null);
        }

        var code = query["code"].ToString();
        var state = query["state"].ToString();
        if (flow is null || code.Length == 0 || state.Length == 0 || !FixedTimeString.AreEqual(state, flow.State)) {
            return (SignInOutcome.InvalidState, null);
        }

        try {
            var idToken = await google.ExchangeCodeAsync(code, flow.CodeVerifier, cancellationToken);
            if (idToken is null) {
                return (SignInOutcome.CodeRejected, null);
            }

            var validation = await validator.ValidateAsync(idToken, flow.Nonce, cancellationToken);
            return validation.Identity is null
                ? (SignInOutcome.InvalidToken, null)
                : (Authorize(validation.Identity), validation.Identity);
        } catch (GoogleUnavailableException exception) {
            logger.LogWarning(exception, "Google sign-in provider failure {FailureCategory}", exception.Category);
            return (SignInOutcome.ProviderUnavailable, null);
        }
    }

    private SignInOutcome Authorize(GoogleIdentity identity)
    {
        if (!identity.EmailVerified) {
            return SignInOutcome.EmailUnverified;
        }

        return policy.Evaluate(identity.HostedDomain, identity.Email) switch
        {
            AccessDecision.Allowed => SignInOutcome.Success,
            AccessDecision.NotAuthorized => SignInOutcome.NotAuthorized,
            _ => SignInOutcome.WrongDomain,
        };
    }

    private FlowPayload? ReadFlow(HttpRequest request)
    {
        var plaintext = protector.Unprotect(AuthCookies.Flow, request.Cookies[AuthCookies.Flow]);
        if (plaintext.IsEmpty) {
            return null;
        }

        try {
            var flow = JsonSerializer.Deserialize(plaintext.Span, AuthJsonContext.Default.FlowPayload);
            var age = clock.GetUtcNow().ToUnixTimeSeconds() - flow?.CreatedAt;
            return age is >= 0 && age <= GoogleSignInEndpoint.FlowLifetime.TotalSeconds ? flow : null;
        } catch (JsonException) {
            return null;
        }
    }

    private void IssueSession(HttpResponse response, GoogleIdentity identity)
    {
        var now = clock.GetUtcNow();
        var expires = now.Add(SessionLifetime);
        var payload = new SessionPayload
        {
            Version = SessionVersion,
            Subject = identity.Subject,
            Email = identity.Email,
            HostedDomain = identity.HostedDomain,
            IssuedAt = now.ToUnixTimeSeconds(),
            ExpiresAt = expires.ToUnixTimeSeconds(),
        };
        response.Cookies.Append(AuthCookies.Session,
            protector.Protect(AuthCookies.Session, JsonSerializer.SerializeToUtf8Bytes(payload, AuthJsonContext.Default.SessionPayload)),
            AuthCookies.Options(expires));
    }
}
