using Scpp.Shared.Contact.Models;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Scpp.Shared.Contact.Api;

internal sealed class ContactRequestHandler
{
    internal static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> Post(
        ContactRequest request, HttpContext context, ILogger<ContactRequestHandler> logger,
        TurnstileVerifier verifier, CancellationToken cancellationToken)
    {
        var (normalized, errors) = ContactRequestValidator.Validate(request);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var verification = await verifier.Verify(request.TurnstileToken!, cancellationToken);
        logger.LogDebug("Contact verification outcome: {Outcome} ({TraceId})", verification, context.TraceIdentifier);
        if (verification != VerificationOutcome.Accepted)
            return TypedResults.Problem(
                statusCode: verification == VerificationOutcome.Rejected ? 403 : 503,
                title: "Contact verification failed. Please try again.");

        logger.LogInformation(
            "Contact request received at {Timestamp} ({TraceId}): {Source}, {Name}, {Email}, {Message}, {ChildName}, {Phone}, {Subject}",
            DateTimeOffset.UtcNow, context.TraceIdentifier, normalized.Source, normalized.Name,
            normalized.Email, normalized.Message, normalized.ChildName, normalized.Phone, normalized.Subject);
        return TypedResults.NoContent();
    }
}
