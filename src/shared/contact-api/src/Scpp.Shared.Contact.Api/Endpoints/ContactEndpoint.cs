using Microsoft.AspNetCore.Http.HttpResults;
using Scpp.Shared.Contact.Api.Interfaces;
using Scpp.Shared.Contact.Api.Verification;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.Endpoints;

internal static class ContactEndpoint
{
    internal static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> Post(
        ContactRequest request, HttpContext context, IContactSubmissionService service,
        CancellationToken cancellationToken)
    {
        var result = await service.SubmitAsync(request, context.TraceIdentifier, cancellationToken);
        if (result.Validation.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(result.Validation.Errors);
        }
        if (result.Verification != VerificationOutcome.Accepted)
        {
            return TypedResults.Problem(
                statusCode: result.Verification == VerificationOutcome.Rejected ? 403 : 503,
                title: "Contact verification failed. Please try again.");
        }

        return TypedResults.NoContent();
    }
}
