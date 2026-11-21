using Scpp.Foundation.Auth.Api.Configuration;

namespace Scpp.Foundation.Auth.Api.Access;

/// <summary>
/// Domain rules. Google's <c>hd</c> request hint accepts one domain, so the server requires the
/// <c>hd</c> claim and the email domain to each be an exact allowed domain.
/// </summary>
internal sealed class AccessPolicy(AuthSettings settings)
{
    internal AccessDecision Evaluate(string? hostedDomain, string email)
    {
        var emailDomain = EmailDomain(email);
        if (hostedDomain is null || emailDomain is null || !IsAllowedDomain(hostedDomain) || !IsAllowedDomain(emailDomain)) {
            return AccessDecision.WrongDomain;
        }

        return settings.AllowedEmails.Count == 0 || settings.AllowedEmails.Contains(email)
            ? AccessDecision.Allowed
            : AccessDecision.NotAuthorized;
    }

    /// <summary>The part after the single '@', or null for anything that is not exactly one local part and one domain.</summary>
    private static string? EmailDomain(string email)
    {
        var at = email.IndexOf('@', StringComparison.Ordinal);
        return at > 0 && at == email.LastIndexOf('@') && at < email.Length - 1 ? email[(at + 1)..] : null;
    }

    // ASCII only: culture-style case folding would let look-alikes such as the Kelvin sign match.
    private bool IsAllowedDomain(string domain) => domain.All(char.IsAscii) && settings.AllowedDomains.Contains(domain);
}
