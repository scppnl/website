using System.Net.Mail;
using System.Text.Json;
using Scpp.Foundation.Booking.Api.Email;
using Scpp.Foundation.Booking.Api.Serialization;

namespace Scpp.Foundation.Booking.Api.Configuration;

internal sealed class BookingEmailSettings(string from, string to, GmailOAuthCredentials credentials)
{
    internal string From { get; } = from;
    internal string To { get; } = to;
    internal GmailOAuthCredentials Credentials { get; } = credentials;

    internal static bool IsMailbox(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= 254 &&
        !value.Any(character => char.IsControl(character) || char.IsWhiteSpace(character)) &&
        MailAddress.TryCreate(value, out var address) && address.DisplayName.Length == 0 &&
        address.Address == value && address.Host.Contains('.');

    internal static BookingEmailSettings Load(IConfiguration configuration)
    {
        const string error = "Configure BookingEmail:From, BookingEmail:To and BOOKING_GMAIL_OAUTH_JSON (client_id, client_secret, refresh_token).";
        var from = configuration["BookingEmail:From"];
        var to = configuration["BookingEmail:To"];
        GmailOAuthCredentials? credentials;
        try
        {
            credentials = JsonSerializer.Deserialize(configuration["BOOKING_GMAIL_OAUTH_JSON"] ?? "null",
                BookingJsonContext.Default.GmailOAuthCredentials);
        }
        catch (JsonException)
        {
            // Never include the secret JSON or parsing exception in startup logs.
            throw new InvalidOperationException(error);
        }
        if (!IsMailbox(from) || !IsMailbox(to) || credentials is null ||
            string.IsNullOrWhiteSpace(credentials.ClientId) || string.IsNullOrWhiteSpace(credentials.ClientSecret) ||
            string.IsNullOrWhiteSpace(credentials.RefreshToken))
            throw new InvalidOperationException(error);
        return new(from!, to!, credentials);
    }
}
