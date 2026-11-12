using System.Collections.Concurrent;
using Serilog.Core;
using Serilog.Events;

namespace Scpp.Shared.Contact.Api.UnitTests.Logging;

internal sealed class CollectingSink : ILogEventSink
{
    internal ConcurrentQueue<LogEvent> Events { get; } = new();

    public void Emit(LogEvent logEvent) => Events.Enqueue(logEvent);
}
