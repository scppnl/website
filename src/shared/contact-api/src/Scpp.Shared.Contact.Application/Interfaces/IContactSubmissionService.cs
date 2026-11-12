using Scpp.Shared.Contact.Application.Models;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Application.Interfaces;

public interface IContactSubmissionService
{
    Task<ContactSubmissionResult> SubmitAsync(
        ContactRequest request, string traceId, CancellationToken cancellationToken);
}
