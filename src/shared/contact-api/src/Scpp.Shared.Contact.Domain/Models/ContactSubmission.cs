namespace Scpp.Shared.Contact.Domain.Models;

public sealed record ContactSubmission(
    string Source,
    string Name,
    string Email,
    string Message,
    string? ChildName,
    string? Phone,
    string? Subject);
