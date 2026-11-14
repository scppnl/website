using System.Text.Json;
using Scpp.Shared.Contact.Infrastructure.Email;
using Scpp.Shared.Contact.Infrastructure.Serialization;

namespace Scpp.Shared.Contact.Api.Configuration;

internal static class ContactEmailConfiguration
{
    internal static ContactEmailSettings Load(IConfiguration configuration)
    {
        const string error = "Configure ContactEmail:From, ContactEmail:FoundationTo, ContactEmail:AssociationTo and CONTACT_GMAIL_OAUTH_JSON (client_id, client_secret, refresh_token).";
        var from = configuration["ContactEmail:From"];
        var foundationTo = configuration["ContactEmail:FoundationTo"];
        var associationTo = configuration["ContactEmail:AssociationTo"];
        GmailOAuthCredentials? credentials;
        try
        {
            credentials = JsonSerializer.Deserialize(configuration["CONTACT_GMAIL_OAUTH_JSON"] ?? "null",
                GmailJsonContext.Default.GmailOAuthCredentials);
        }
        catch (JsonException)
        {
            throw new InvalidOperationException(error);
        }
        if (!MailboxAddress.IsValid(from) || !MailboxAddress.IsValid(foundationTo) || !MailboxAddress.IsValid(associationTo) ||
            credentials is null || string.IsNullOrWhiteSpace(credentials.ClientId) ||
            string.IsNullOrWhiteSpace(credentials.ClientSecret) || string.IsNullOrWhiteSpace(credentials.RefreshToken))
            throw new InvalidOperationException(error);
        return new(from!, foundationTo!, associationTo!, credentials);
    }
}
