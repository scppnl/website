using Microsoft.Extensions.Logging;
using Scpp.Foundation.Booking.Api.Email;

namespace Scpp.Foundation.Booking.Api.UnitTests;

internal sealed class EmailLogRecorder : ILogger<GmailBookingEmailSender>
{
    internal List<string> Messages { get; } = [];
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
        Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
}
