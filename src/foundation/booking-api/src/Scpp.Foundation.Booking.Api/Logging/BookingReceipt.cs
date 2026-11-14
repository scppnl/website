using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Logging;

// Explicitly list receipt fields so credentials cannot enter the existing submission log.
internal sealed record BookingReceipt
{
    public string? Name { get; init; }
    public string? Organisation { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Building { get; init; }
    public string? GroupType { get; init; }
    public DateOnly Date { get; init; }
    public string[]? Dayparts { get; init; }
    public int Guests { get; init; }
    public string? Remarks { get; init; }

    internal static BookingReceipt From(BookingRequestDto request) => new() {
        Name = request.Name, Organisation = request.Organisation, Email = request.Email, Phone = request.Phone,
        Building = request.Building, GroupType = request.GroupType, Date = request.Date,
        Dayparts = request.Dayparts, Guests = request.Guests, Remarks = request.Remarks
    };
}
