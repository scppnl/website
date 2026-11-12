namespace Scpp.Shared.ContactApi;

internal sealed record ContactRequest(
    string? Source = null,
    string? Name = null,
    string? Email = null,
    string? Message = null,
    string? ChildName = null,
    string? Phone = null,
    string? Subject = null);
