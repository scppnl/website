using Scpp.Shared.Contact.Domain.Models;

namespace Scpp.Shared.Contact.Api.Validation;

public sealed class ContactValidationResult
{
    internal ContactValidationResult(ContactSubmission? submission, Dictionary<string, string[]> errors)
    {
        Submission = submission;
        Errors = errors;
    }

    public ContactSubmission? Submission { get; }

    public Dictionary<string, string[]> Errors { get; }
}
