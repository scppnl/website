namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

internal sealed class TestClock : TimeProvider
{
    private DateTimeOffset now = new(2026, 11, 21, 12, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => now;

    internal void Advance(TimeSpan amount) => now = now.Add(amount);
}
