namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

internal static class ResponseCookies
{
    /// <summary>The whole Set-Cookie header for a cookie name, or null.</summary>
    internal static string? Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.FirstOrDefault(value => value.StartsWith(name + "=", StringComparison.Ordinal))
            : null;

    /// <summary>The cookie value, or null when it was not set or was deleted.</summary>
    internal static string? Value(HttpResponseMessage response, string name)
    {
        var header = Header(response, name);
        var value = header?[(name.Length + 1)..].Split(';')[0];
        return string.IsNullOrEmpty(value) ? null : value;
    }

    internal static bool IsDeleted(HttpResponseMessage response, string name) =>
        Header(response, name) is { } header && header.StartsWith(name + "=;", StringComparison.Ordinal);
}
