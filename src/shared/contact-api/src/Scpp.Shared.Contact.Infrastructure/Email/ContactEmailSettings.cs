namespace Scpp.Shared.Contact.Infrastructure.Email;

internal sealed record ContactEmailSettings(
    string From, string FoundationTo, string AssociationTo, GmailOAuthCredentials Credentials)
{
    internal string Recipient(string source) => source switch
    {
        "foundation" => FoundationTo,
        "association" => AssociationTo,
        _ => throw new ArgumentException("Unknown contact source.", nameof(source))
    };
}
