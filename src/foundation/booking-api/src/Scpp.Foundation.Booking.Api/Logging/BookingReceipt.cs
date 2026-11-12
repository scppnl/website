using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Logging;

// Explicitly list receipt fields so credentials cannot enter the existing submission log.
internal sealed record BookingReceipt(
    string? Name, string? Organisation, string? Email, string? Phone, string? Building,
    string? GroupType, DateOnly Date, string[]? Dayparts, int Guests, string? Remarks)
{
    internal static BookingReceipt From(BookingRequestDto request) => new(
        request.Name, request.Organisation, request.Email, request.Phone, request.Building,
        request.GroupType, request.Date, request.Dayparts, request.Guests, request.Remarks);
}
