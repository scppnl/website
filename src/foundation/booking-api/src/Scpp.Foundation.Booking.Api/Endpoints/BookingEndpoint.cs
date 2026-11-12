using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Scpp.Foundation.Booking.Api.Logging;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Api.Validation;
using Scpp.Foundation.Booking.Api.Verification;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Endpoints;

internal sealed class BookingEndpoint
{
    internal static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> Post(
        BookingRequestDto request, BookingRequestValidator validator, ILogger<BookingEndpoint> logger,
        TurnstileVerifier verifier, CancellationToken cancellationToken)
    {
        var errors = validator.Validate(request);
        if (errors.Count > 0)
            return TypedResults.ValidationProblem(errors);

        var verification = await verifier.Verify(request.TurnstileToken!, cancellationToken);
        if (verification != VerificationOutcome.Accepted)
            return TypedResults.Problem(
                statusCode: verification == VerificationOutcome.Rejected ? 403 : 503,
                title: "Booking verification failed. Please try again.");

        logger.LogInformation("Booking request received: {BookingRequest}",
            JsonSerializer.Serialize(BookingReceipt.From(request), BookingJsonContext.Default.BookingReceipt));
        return TypedResults.NoContent();
    }
}
