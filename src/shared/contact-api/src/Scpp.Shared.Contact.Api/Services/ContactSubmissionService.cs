using Scpp.Shared.Contact.Api.Interfaces;
using Scpp.Shared.Contact.Api.Models;
using Scpp.Shared.Contact.Api.Validation;
using Scpp.Shared.Contact.Api.Verification;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.Services;

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
        bool? delivered = null;
        if (verification == VerificationOutcome.Accepted)
        {
            delivered = await sink.SubmitAsync(submission, traceId, cancellationToken);
        }

        return new ContactSubmissionResult(result, verification) { Delivered = delivered };
    }
}
