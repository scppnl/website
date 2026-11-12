using Scpp.Shared.Contact.Application.Interfaces;
using Scpp.Shared.Contact.Application.Validation;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Application.Services;

public sealed class ContactSubmissionService(IContactSubmissionSink sink) : IContactSubmissionService
{
    public async Task<ContactValidationResult> SubmitAsync(
        ContactRequest request, string traceId, CancellationToken cancellationToken)
    {
        var result = ContactRequestValidator.Validate(request);
        if (result.Submission is { } submission)
        {
            await sink.SubmitAsync(submission, traceId, cancellationToken);
        }

        return result;
    }
}
