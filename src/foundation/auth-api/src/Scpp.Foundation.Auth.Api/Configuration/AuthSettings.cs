namespace Scpp.Foundation.Auth.Api.Configuration;

/// <summary>Validated sign-in settings. Every redirect target is derived from these values only.</summary>
internal sealed record AuthSettings(
    Uri ApiOrigin,
    Uri FrontendOrigin,
    string PostSignInPath,
    IReadOnlySet<string> AllowedDomains,
    IReadOnlySet<string> AllowedEmails,
    string ClientId,
    string ClientSecret)
{
    // The frontend contract (PR #53): these pages exist and cannot be configured away.
    internal const string SignInPath = "/inloggen";
    internal const string AccessDeniedPath = "/inloggen/geen-toegang";
    internal const string CallbackPath = "/auth/google/callback";

    private const string ConfigurationError =
        "Configure AUTH_GOOGLE_CLIENT_SECRET, Auth:Google:ClientId, Auth:ApiOrigin, Auth:FrontendOrigin, Auth:PostSignInPath and Auth:AllowedDomains. " +
        "Origins must be bare HTTPS origins outside Development.";

    internal Uri CallbackUri => new(ApiOrigin, CallbackPath);

    internal Uri FrontendUri(string path) => new(FrontendOrigin, path);

    internal static AuthSettings Load(IConfiguration configuration, IHostEnvironment environment)
    {
        var secret = configuration["AUTH_GOOGLE_CLIENT_SECRET"];
        var clientId = configuration["Auth:Google:ClientId"];
        var postSignIn = configuration["Auth:PostSignInPath"] ?? "/";
        var domains = ReadSet(configuration, "Auth:AllowedDomains");
        var emails = ReadSet(configuration, "Auth:AllowedEmails");
        var apiOrigin = ParseOrigin(configuration["Auth:ApiOrigin"], environment);
        var frontendOrigin = ParseOrigin(configuration["Auth:FrontendOrigin"], environment);

        if (string.IsNullOrWhiteSpace(secret) ||
            string.IsNullOrWhiteSpace(clientId) || !clientId.EndsWith(".apps.googleusercontent.com", StringComparison.Ordinal) ||
            apiOrigin is null || frontendOrigin is null ||
            !IsLocalPath(postSignIn) ||
            domains.Count == 0 || domains.Any(domain => !IsHostname(domain)) ||
            emails.Any(email => !email.Contains('@', StringComparison.Ordinal))) {
            throw new InvalidOperationException(ConfigurationError);
        }

        return new(apiOrigin, frontendOrigin, postSignIn, domains, emails, clientId, secret);
    }

    private static HashSet<string> ReadSet(IConfiguration configuration, string section) =>
        configuration.GetSection(section).GetChildren()
            .Select(child => (child.Value ?? "").Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.Ordinal);

    private static bool IsLocalPath(string path) =>
        path.StartsWith('/') && !path.StartsWith("//", StringComparison.Ordinal) &&
        !path.Contains('\\', StringComparison.Ordinal) && !path.Any(char.IsControl);

    private static bool IsHostname(string domain) =>
        !domain.Contains('*', StringComparison.Ordinal) && domain.Contains('.', StringComparison.Ordinal) &&
        Uri.CheckHostName(domain) == UriHostNameType.Dns;

    private static Uri? ParseOrigin(string? value, IHostEnvironment environment)
    {
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value, UriKind.Absolute, out var origin) ||
            origin.GetLeftPart(UriPartial.Authority) != value || origin.UserInfo.Length > 0) {
            return null;
        }

        var loopback = origin.IsLoopback;
        var allowed = origin.Scheme == Uri.UriSchemeHttps && !loopback ||
            environment.IsDevelopment() && loopback && (origin.Scheme == Uri.UriSchemeHttp || origin.Scheme == Uri.UriSchemeHttps);
        return allowed ? origin : null;
    }
}
