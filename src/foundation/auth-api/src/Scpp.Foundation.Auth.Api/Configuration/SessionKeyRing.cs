using System.Text.Json;
using System.Text.RegularExpressions;
using Scpp.Foundation.Auth.Api.Serialization;

namespace Scpp.Foundation.Auth.Api.Configuration;

/// <summary>Rotatable AES-256 keys. New cookies use the active key; any listed key can still decrypt.</summary>
internal sealed partial class SessionKeyRing
{
    internal const int KeySize = 32;

    private const string ConfigurationError =
        "Configure AUTH_SESSION_KEYS as JSON with activeKeyId and keys (base64, 32 bytes each).";

    private SessionKeyRing(string activeKeyId, IReadOnlyDictionary<string, byte[]> keys)
    {
        ActiveKeyId = activeKeyId;
        Keys = keys;
    }

    internal string ActiveKeyId { get; }

    internal IReadOnlyDictionary<string, byte[]> Keys { get; }

    internal static SessionKeyRing Load(string? json)
    {
        SessionKeyRingDocument? document;
        try {
            document = string.IsNullOrWhiteSpace(json)
                ? null
                : JsonSerializer.Deserialize(json, AuthJsonContext.Default.SessionKeyRingDocument);
        } catch (JsonException) {
            throw new InvalidOperationException(ConfigurationError);
        }

        if (document?.ActiveKeyId is null || document.Keys is not { Count: > 0 } ||
            !document.Keys.ContainsKey(document.ActiveKeyId)) {
            throw new InvalidOperationException(ConfigurationError);
        }

        var keys = new Dictionary<string, byte[]>(StringComparer.Ordinal);
        foreach (var (id, encoded) in document.Keys) {
            var key = new byte[KeySize];
            if (!KeyId().IsMatch(id) || !Convert.TryFromBase64String(encoded, key, out var written) || written != KeySize) {
                throw new InvalidOperationException(ConfigurationError);
            }

            keys[id] = key;
        }

        return new(document.ActiveKeyId, keys);
    }

    [GeneratedRegex(@"\A[A-Za-z0-9._-]{1,64}\z")]
    private static partial Regex KeyId();
}
