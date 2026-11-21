using System.Collections.Concurrent;
using Serilog.Core;
using Serilog.Events;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

internal sealed class CollectingSink : ILogEventSink
{
    internal ConcurrentQueue<LogEvent> Events { get; } = new();

    public void Emit(LogEvent logEvent) => Events.Enqueue(logEvent);
}
