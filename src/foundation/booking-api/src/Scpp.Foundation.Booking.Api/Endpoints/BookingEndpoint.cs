using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Api.Validation;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Endpoints;

internal sealed class BookingEndpoint
{
    internal static Results<NoContent, ValidationProblem> Post(
        BookingRequestDto request, BookingRequestValidator validator, ILogger<BookingEndpoint> logger)
    {
        var errors = validator.Validate(request);
        if (errors.Count > 0)
            return TypedResults.ValidationProblem(errors);

        logger.LogInformation("Booking request received: {BookingRequest}",
            JsonSerializer.Serialize(request, BookingJsonContext.Default.BookingRequestDto));
        return TypedResults.NoContent();
    }
}
