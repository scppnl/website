using Scpp.Shared.Contact.Application.Interfaces;
using Scpp.Shared.Contact.Application.Models;
using Scpp.Shared.Contact.Application.Validation;
using Scpp.Shared.Contact.Application.Verification;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Application.Services;

public sealed class ContactSubmissionService(IContactSubmissionSink sink, IContactVerificationService verifier)
    : IContactSubmissionService
{
    public async Task<ContactSubmissionResult> SubmitAsync(
        ContactRequest request, string traceId, CancellationToken cancellationToken)
    {
        var result = ContactRequestValidator.Validate(request);
        if (result.Submission is not { } submission)
        {
            return new ContactSubmissionResult(result, null);
        }

        var verification = await verifier.VerifyAsync(request.TurnstileToken!, traceId, cancellationToken);
        if (verification == VerificationOutcome.Accepted)
        {
            await sink.SubmitAsync(submission, traceId, cancellationToken);
        }

        return new ContactSubmissionResult(result, verification);
    }
}
