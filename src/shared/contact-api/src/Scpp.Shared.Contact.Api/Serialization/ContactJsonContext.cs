using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.Serialization;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ContactRequest))]
[JsonSerializable(typeof(HttpValidationProblemDetails))]
[JsonSerializable(typeof(ProblemDetails))]
internal partial class ContactJsonContext : JsonSerializerContext;
