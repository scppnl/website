using Scpp.Shared.Contact.Api.Interfaces;
using Scpp.Shared.Contact.Domain.Models;
using Scpp.Shared.Contact.Infrastructure.Email;
using Scpp.Shared.Contact.Infrastructure.Logging;

namespace Scpp.Shared.Contact.Api.Services;

internal sealed class ContactSubmissionSink(GmailContactEmailSender sender, LoggingContactSubmissionSink sink) : IContactSubmissionSink
{
    public async Task<bool> SubmitAsync(ContactSubmission submission, string traceId, CancellationToken cancellationToken)
    {
        if (!await sender.Send(submission, cancellationToken)) return false;
        // Record Gmail acceptance even if the visitor disconnected during sending.
        await sink.SubmitAsync(submission, traceId, CancellationToken.None);
        return true;
    }
}
