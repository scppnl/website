using System.Text.Json.Serialization;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Google;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Contracts;

namespace Scpp.Foundation.Auth.Api.Serialization;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(SessionResponseDto))]
[JsonSerializable(typeof(GoogleTokenResponse))]
[JsonSerializable(typeof(FlowPayload))]
[JsonSerializable(typeof(SessionPayload))]
[JsonSerializable(typeof(SessionKeyRingDocument))]
internal partial class AuthJsonContext : JsonSerializerContext;
