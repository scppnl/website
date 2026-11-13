using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Email;

internal interface IBookingEmailSender
{
    Task<bool> Send(BookingRequestDto request, CancellationToken cancellationToken);
}
