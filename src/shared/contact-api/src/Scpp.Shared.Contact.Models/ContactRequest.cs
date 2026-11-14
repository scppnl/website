namespace Scpp.Shared.Contact.Models;

public sealed record ContactRequest
{
    public string? Source { get; init; }
    public string? Name { get; init; }
    public string? Email { get; init; }
    public string? Message { get; init; }
    public string? ChildName { get; init; }
    public string? Phone { get; init; }
    public string? Subject { get; init; }
    public string? TurnstileToken { get; init; }
}
