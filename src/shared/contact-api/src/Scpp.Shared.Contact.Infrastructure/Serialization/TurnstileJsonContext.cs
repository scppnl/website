using System.Text.Json.Serialization;
using Scpp.Shared.Contact.Infrastructure.Verification;

namespace Scpp.Shared.Contact.Infrastructure.Serialization;

[JsonSerializable(typeof(TurnstileResponse))]
internal partial class TurnstileJsonContext : JsonSerializerContext;
