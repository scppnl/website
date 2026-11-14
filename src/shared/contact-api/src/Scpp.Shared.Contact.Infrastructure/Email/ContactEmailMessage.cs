using System.Globalization;
using System.Text;
using Scpp.Shared.Contact.Domain.Models;

namespace Scpp.Shared.Contact.Infrastructure.Email;

internal static class ContactEmailMessage
{
    internal static string Create(ContactSubmission request, ContactEmailSettings settings, DateTimeOffset now)
    {
        var to = settings.Recipient(request.Source);
        if (!MailboxAddress.IsValid(request.Email) || !MailboxAddress.IsValid(settings.From) || !MailboxAddress.IsValid(to))
            throw new ArgumentException("Invalid contact mailbox.");
        var source = request.Source == "foundation" ? "Stichting Clubhuis De Wildert" : "Scouting Petrus & Paulus";
        var subject = request.Subject switch
        {
            "question" => "Algemene vraag", "viewing" => "Bezichtiging", "other" => "Anders", _ => "Niet opgegeven"
        };
        var extra = request.Source == "foundation"
            ? $"Telefoon: {Optional(request.Phone)}\nOnderwerp: {subject}"
            : $"Naam kind: {Optional(request.ChildName)}";
        var text = $"""
            Nieuw contactbericht voor {source}

            Naam: {request.Name}
            E-mailadres: {request.Email}
            {extra}

            Bericht:
            {request.Message}
            """;
        var title = request.Source == "foundation" ? $"Contact stichting – {subject}" : "Contact vereniging";
        var encodedSubject = Convert.ToBase64String(Encoding.UTF8.GetBytes(title));
        var body = Convert.ToBase64String(Encoding.UTF8.GetBytes(text.ReplaceLineEndings("\r\n")), Base64FormattingOptions.InsertLineBreaks);
        var mime = $"From: {settings.From}\r\nTo: {to}\r\nReply-To: {request.Email}\r\n" +
            $"Subject: =?utf-8?B?{encodedSubject}?=\r\nDate: {now.UtcDateTime.ToString("r", CultureInfo.InvariantCulture)}\r\n" +
            $"Message-ID: <{Guid.NewGuid():N}@scpp.nl>\r\nMIME-Version: 1.0\r\n" +
            $"Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{body}\r\n";
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(mime)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string Optional(string? value) => string.IsNullOrWhiteSpace(value) ? "Niet opgegeven" : value;
}
