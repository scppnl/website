using System.Collections.Concurrent;
using Scpp.Shared.Contact.Infrastructure.Logging;
using Serilog.Core;
using Serilog.Events;

namespace Scpp.Shared.Contact.Api.UnitTests.Endpoints;

internal sealed class RequestLogs : ILogEventSink
{
    internal ConcurrentBag<LogEvent> Entries { get; } = [];

    public void Emit(LogEvent logEvent)
    {
        if (logEvent.Level == LogEventLevel.Information &&
            logEvent.Properties.TryGetValue("SourceContext", out var category) &&
            ((ScalarValue)category).Value?.ToString() == typeof(LoggingContactSubmissionSink).FullName)
        {
            Entries.Add(logEvent);
        }
    }
}
