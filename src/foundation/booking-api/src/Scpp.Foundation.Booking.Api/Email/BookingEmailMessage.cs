using System.Globalization;
using System.Text;
using Scpp.Foundation.Booking.Api.Configuration;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Email;

internal static class BookingEmailMessage
{
    internal static string Create(BookingRequestDto request, BookingEmailSettings settings, DateTimeOffset now)
    {
        // Only validated mailbox addresses enter headers. Free text stays in the encoded body.
        if (!BookingEmailSettings.IsMailbox(request.Email)) throw new ArgumentException("Invalid reply mailbox.");
        var date = request.Date.ToString("dd-MM-yyyy", CultureInfo.InvariantCulture);
        var building = request.Building switch {
            "groot" => "Groot gebouw", "klein" => "Klein gebouw", "beide" => "Beide gebouwen", _ => "Alleen buitenterrein"
        };
        var group = request.GroupType switch {
            "family" => "Gezin of familie", "school" => "School", "business" => "Bedrijf", _ => "Anders"
        };
        var dayparts = string.Join(", ", new[] { "ochtend", "middag", "avond" }.Where(part => request.Dayparts!.Contains(part)));
        var text = $"""
            Nieuwe verhuuraanvraag

            Dit is een aanvraag. De reservering moet nog worden bevestigd.

            Naam: {request.Name}
            Organisatie: {Optional(request.Organisation)}
            E-mailadres: {request.Email}
            Telefoon: {Optional(request.Phone)}
            Gebouw: {building}
            Type groep: {group}
            Datum: {date}
            Dagdelen: {dayparts}
            Aantal gasten: {request.Guests.ToString(CultureInfo.InvariantCulture)}

            Opmerkingen:
            {Optional(request.Remarks)}
            """;
        var subject = Convert.ToBase64String(Encoding.UTF8.GetBytes($"Nieuwe verhuuraanvraag – {date}"));
        var body = Convert.ToBase64String(Encoding.UTF8.GetBytes(text.ReplaceLineEndings("\r\n")), Base64FormattingOptions.InsertLineBreaks);
        var mime = $"From: {settings.From}\r\nTo: {settings.To}\r\nReply-To: {request.Email}\r\n" +
            $"Subject: =?utf-8?B?{subject}?=\r\nDate: {now.UtcDateTime.ToString("r", CultureInfo.InvariantCulture)}\r\n" +
            $"Message-ID: <{Guid.NewGuid():N}@scpp.nl>\r\nMIME-Version: 1.0\r\n" +
            $"Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{body}\r\n";
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(mime)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string Optional(string? value) => string.IsNullOrWhiteSpace(value) ? "Niet opgegeven" : value;
}
