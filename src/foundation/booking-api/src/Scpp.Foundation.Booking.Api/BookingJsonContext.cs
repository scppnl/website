using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(BookingRequestDto))]
[JsonSerializable(typeof(HttpValidationProblemDetails))]
internal partial class BookingJsonContext : JsonSerializerContext;
