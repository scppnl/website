using Scpp.Foundation.Booking.Api.Email;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.UnitTests;

internal sealed class BookingEmailStub : IBookingEmailSender
{
    internal int Calls { get; private set; }
    internal bool Accepted { get; set; } = true;

    public Task<bool> Send(BookingRequestDto request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Calls++;
        return Task.FromResult(Accepted);
    }
}
