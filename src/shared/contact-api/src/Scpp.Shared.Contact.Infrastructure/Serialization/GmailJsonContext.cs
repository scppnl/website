using System.Text.Json.Serialization;
using Scpp.Shared.Contact.Infrastructure.Email;

namespace Scpp.Shared.Contact.Infrastructure.Serialization;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(GmailOAuthCredentials))]
[JsonSerializable(typeof(GmailTokenResponse))]
[JsonSerializable(typeof(GmailSendRequest))]
[JsonSerializable(typeof(GmailSendResponse))]
internal partial class GmailJsonContext : JsonSerializerContext;
