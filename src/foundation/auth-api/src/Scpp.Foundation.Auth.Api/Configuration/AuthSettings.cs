namespace Scpp.Foundation.Auth.Api.Configuration;

/// <summary>Validated sign-in settings. Every redirect target is derived from these values only.</summary>
internal sealed record AuthSettings(
    Uri ApiOrigin,
    Uri FrontendOrigin,
    string PostSignInPath,
    IReadOnlySet<string> AllowedDomains,
    IReadOnlySet<string> AllowedEmails,
    IReadOnlyList<PermissionRule> Permissions,
    string ClientId,
    string ClientSecret)
{
    // The frontend contract (PR #53): these pages exist and cannot be configured away.
    internal const string SignInPath = "/inloggen";
    internal const string AccessDeniedPath = "/inloggen/geen-toegang";
    internal const string CallbackPath = "/auth/google/callback";

    private const string ConfigurationError =
        "Configure AUTH_GOOGLE_CLIENT_SECRET, Auth:Google:ClientId, Auth:ApiOrigin, Auth:FrontendOrigin, Auth:PostSignInPath and Auth:AllowedDomains. " +
        "Each Auth:Permissions entry needs a lowercase dotted Name and Groups that are addresses on an allowed domain. " +
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
        var permissions = ReadPermissions(configuration, domains);
        var apiOrigin = ParseOrigin(configuration["Auth:ApiOrigin"], environment);
        var frontendOrigin = ParseOrigin(configuration["Auth:FrontendOrigin"], environment);

        if (string.IsNullOrWhiteSpace(secret) ||
            string.IsNullOrWhiteSpace(clientId) || !clientId.EndsWith(".apps.googleusercontent.com", StringComparison.Ordinal) ||
            apiOrigin is null || frontendOrigin is null || permissions is null ||
            !IsLocalPath(postSignIn) ||
            domains.Count == 0 || domains.Any(domain => !IsHostname(domain)) ||
            emails.Any(email => !email.All(char.IsAscii) || !email.Contains('@', StringComparison.Ordinal))) {
            throw new InvalidOperationException(ConfigurationError);
        }

        return new(apiOrigin, frontendOrigin, postSignIn, domains, emails, permissions, clientId, secret);
    }

    /// <summary>Null when any entry is invalid. Names are unique, and every group is an address on an allowed domain.</summary>
    private static List<PermissionRule>? ReadPermissions(IConfiguration configuration, IReadOnlySet<string> domains)
    {
        var rules = new List<PermissionRule>();
        
        foreach (var section in configuration.GetSection("Auth:Permissions").GetChildren()) {
            var name = section["Name"] ?? "";
            var groups = ReadSet(section, "Groups");
            if (!IsPermissionName(name) || rules.Exists(rule => rule.Name == name) ||
                groups.Count == 0 || !groups.All(group => IsGroupAddress(group, domains))) {
                return null;
            }

            rules.Add(new(name, groups));
        }

        return rules;
    }

    /// <summary>Dot-separated lowercase segments of ASCII letters, digits and hyphens, such as <c>bookings.manage</c>.</summary>
    private static bool IsPermissionName(string name) =>
        name.Split('.').All(segment => segment.Length > 0 && segment.All(character => char.IsAsciiLetterLower(character) || char.IsAsciiDigit(character) || character == '-'));

    /// <summary>One local part and an allowed domain, in a deliberately small character set: it ends up in a query string literal.</summary>
    private static bool IsGroupAddress(string address, IReadOnlySet<string> domains)
    {
        var at = address.IndexOf('@', StringComparison.Ordinal);
        
        return at > 0 && at == address.LastIndexOf('@') && at < address.Length - 1 &&
            address.All(character => char.IsAsciiLetterOrDigit(character) || character is '@' or '.' or '_' or '-' or '+') &&
            domains.Contains(address[(at + 1)..]);
    }

    private static HashSet<string> ReadSet(IConfiguration configuration, string section) =>
        configuration.GetSection(section).GetChildren()
            .Select(child => (child.Value ?? "").Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    private static bool IsLocalPath(string path) =>
        path.StartsWith('/') && !path.StartsWith("//", StringComparison.Ordinal) &&
        !path.Contains('\\', StringComparison.Ordinal) && !path.Any(char.IsControl);

    private static bool IsHostname(string domain) =>
        domain.All(char.IsAscii) && !domain.Contains('*', StringComparison.Ordinal) && domain.Contains('.', StringComparison.Ordinal) &&
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
