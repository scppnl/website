using Scpp.Shared.Contact.Domain.Models;

namespace Scpp.Shared.Contact.Api.Interfaces;

public interface IContactSubmissionSink
{
    Task SubmitAsync(ContactSubmission submission, string traceId, CancellationToken cancellationToken);
}
