namespace Scpp.Shared.Contact.Api.UnitTests.Email;

internal sealed class EmailTestClock : TimeProvider
{
    internal DateTimeOffset Now { get; set; } = new(2027, 6, 4, 12, 0, 0, TimeSpan.Zero);
    public override DateTimeOffset GetUtcNow() => Now;
}
