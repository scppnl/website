namespace Scpp.Foundation.Auth.Api.Http;

internal static class AuthResponseHeaders
{
    /// <summary>Sign-in responses carry cookies and redirects; nothing under /auth may be cached.</summary>
    internal static void UseAuthNoStore(this WebApplication app) =>
        app.Use((context, next) => {
            if (context.Request.Path.StartsWithSegments("/auth")) {
                context.Response.Headers.CacheControl = "no-store";
            }

            return next(context);
        });
}
