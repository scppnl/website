using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Google;
using Scpp.Foundation.Auth.Api.Serialization;
using Scpp.Foundation.Auth.Api.Sessions;

namespace Scpp.Foundation.Auth.Api.Endpoints;

/// <summary>Starts the authorization code flow with PKCE, state and nonce.</summary>
internal sealed class GoogleSignInEndpoint(AuthSettings settings, CookieProtector protector, TimeProvider clock)
{
    internal const string SelectAccount = "select_account";
    internal static readonly TimeSpan FlowLifetime = TimeSpan.FromMinutes(10);

    internal IResult Get(HttpContext context)
    {
        // Only the one known prompt value is ever honoured; nothing else from the query is forwarded.
        var selectAccount = context.Request.Query["prompt"].ToString() == SelectAccount;
        if (!string.Equals(context.Request.Host.Value, settings.ApiOrigin.Authority, StringComparison.OrdinalIgnoreCase)) {
            // The flow cookie is host-only, so the flow must start on the host that receives the callback.
            var canonical = new Uri(settings.ApiOrigin, "/auth/google").AbsoluteUri;
            return TypedResults.Redirect(selectAccount ? $"{canonical}?prompt={SelectAccount}" : canonical);
        }

        var pkce = PkcePair.Create();
        var flow = new FlowPayload
        {
            State = PkcePair.Random(),
            Nonce = PkcePair.Random(),
            CodeVerifier = pkce.Verifier,
            CreatedAt = clock.GetUtcNow().ToUnixTimeSeconds(),
        };
        var parameters = new Dictionary<string, string?>
        {
            ["response_type"] = "code",
            ["client_id"] = settings.ClientId,
            ["redirect_uri"] = settings.CallbackUri.AbsoluteUri,
            ["scope"] = "openid email",
            ["state"] = flow.State,
            ["nonce"] = flow.Nonce,
            ["code_challenge"] = pkce.Challenge,
            ["code_challenge_method"] = "S256",
            ["hd"] = "*",
        };
        if (selectAccount) {
            parameters["prompt"] = SelectAccount;
        }

        context.Response.Cookies.Append(AuthCookies.Flow,
            protector.Protect(AuthCookies.Flow, JsonSerializer.SerializeToUtf8Bytes(flow, AuthJsonContext.Default.FlowPayload)),
            AuthCookies.Options(clock.GetUtcNow().Add(FlowLifetime)));
        return TypedResults.Redirect(QueryHelpers.AddQueryString(GoogleEndpoints.Authorization, parameters));
    }
}
