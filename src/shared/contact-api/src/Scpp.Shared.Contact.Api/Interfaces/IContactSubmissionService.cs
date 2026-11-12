using Scpp.Shared.Contact.Api.Models;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.Interfaces;

public interface IContactSubmissionService
{
    Task<ContactSubmissionResult> SubmitAsync(
        ContactRequest request, string traceId, CancellationToken cancellationToken);
}
