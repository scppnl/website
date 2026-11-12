namespace Scpp.Foundation.Booking.Contracts;

public sealed class BookingRequestDto
{
    public string? Name { get; init; }
    public string? Organisation { get; init; } = "";
    public string? Email { get; init; }
    public string? Phone { get; init; } = "";
    public string? Building { get; init; }
    public string? GroupType { get; init; }
    public DateOnly Date { get; init; }
    public string[]? Dayparts { get; init; }
    public int Guests { get; init; }
    public string? Remarks { get; init; } = "";
}
