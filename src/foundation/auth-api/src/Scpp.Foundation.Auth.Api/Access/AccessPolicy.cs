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
        var at = email.LastIndexOf('@');
        var emailDomain = at > 0 ? email[(at + 1)..].ToLowerInvariant() : "";
        if (hostedDomain is null || !settings.AllowedDomains.Contains(hostedDomain.ToLowerInvariant()) ||
            !settings.AllowedDomains.Contains(emailDomain)) {
            return AccessDecision.WrongDomain;
        }

        return settings.AllowedEmails.Count == 0 || settings.AllowedEmails.Contains(email.ToLowerInvariant())
            ? AccessDecision.Allowed
            : AccessDecision.NotAuthorized;
    }
}
