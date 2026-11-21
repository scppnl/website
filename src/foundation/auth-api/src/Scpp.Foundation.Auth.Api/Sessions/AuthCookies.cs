namespace Scpp.Foundation.Auth.Api.Sessions;

/// <summary>
/// Cookie names and options. <c>__Host-</c> cookies are host-only, Secure and Path=/. Lax lets the
/// flow cookie return on Google's top-level redirect and lets same-site fetches carry the session.
/// </summary>
internal static class AuthCookies
{
    internal const string Flow = "__Host-scpp-auth-flow";
    internal const string Session = "__Host-scpp-session";

    internal static CookieOptions Options(DateTimeOffset expires) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Lax,
        Path = "/",
        Expires = expires,
    };

    internal static void Clear(HttpResponse response, string name) =>
        response.Cookies.Delete(name, new CookieOptions { Secure = true, SameSite = SameSiteMode.Lax, Path = "/" });
}
