using Microsoft.AspNetCore.Http.HttpResults;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Sessions;

namespace Scpp.Foundation.Auth.Api.Endpoints;

/// <summary>
/// Ends the session in this browser by deleting its cookie. Only the foundation site's origin may do so,
/// so another site cannot sign a visitor out. Sessions are stateless: a copied cookie stays valid until it expires.
/// </summary>
internal sealed class SignOutEndpoint(AuthSettings settings, ILogger<SignOutEndpoint> logger)
{
    internal Results<NoContent, StatusCodeHttpResult> Delete(HttpContext context)
    {
        var origin = context.Request.Headers.Origin.ToString();
        if (!string.Equals(origin, settings.FrontendOrigin.GetLeftPart(UriPartial.Authority), StringComparison.Ordinal)) {
            return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
        }

        AuthCookies.Clear(context.Response, AuthCookies.Session);
        logger.LogInformation("Session ended");
        return TypedResults.NoContent();
    }
}
