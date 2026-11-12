using Scpp.Shared.Contact.Application.Validation;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Application.Interfaces;

public interface IContactSubmissionService
{
    Task<ContactValidationResult> SubmitAsync(
        ContactRequest request, string traceId, CancellationToken cancellationToken);
}
