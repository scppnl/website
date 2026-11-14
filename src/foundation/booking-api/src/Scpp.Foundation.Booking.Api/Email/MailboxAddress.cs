using System.Net.Mail;

namespace Scpp.Foundation.Booking.Api.Email;

internal static class MailboxAddress
{
    internal static bool IsValid(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= 254 &&
        !value.Any(character => char.IsControl(character) || char.IsWhiteSpace(character)) &&
        MailAddress.TryCreate(value, out var address) && address.DisplayName.Length == 0 &&
        address.Address == value;
}
