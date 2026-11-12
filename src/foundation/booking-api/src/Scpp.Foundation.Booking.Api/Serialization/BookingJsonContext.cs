using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Scpp.Foundation.Booking.Api.Logging;
using Scpp.Foundation.Booking.Api.Verification;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Serialization;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(BookingRequestDto))]
[JsonSerializable(typeof(HttpValidationProblemDetails))]
[JsonSerializable(typeof(ProblemDetails))]
[JsonSerializable(typeof(TurnstileResponse))]
[JsonSerializable(typeof(BookingReceipt))]
internal partial class BookingJsonContext : JsonSerializerContext;
