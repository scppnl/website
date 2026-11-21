using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using Scpp.Foundation.Auth.Api.Configuration;

namespace Scpp.Foundation.Auth.Api.Sessions;

/// <summary>
/// AES-256-GCM cookie encryption: base64url(version, key id length, key id, nonce, ciphertext, tag).
/// The cookie name is authenticated, so one cookie cannot be replayed as another.
/// </summary>
internal sealed class CookieProtector(SessionKeyRing keyRing)
{
    private const byte Version = 1;
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private const int MaxCookieLength = 4096;

    internal string Protect(string cookieName, byte[] plaintext)
    {
        var keyId = Encoding.UTF8.GetBytes(keyRing.ActiveKeyId);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSize];
        using (var aes = new AesGcm(keyRing.Keys[keyRing.ActiveKeyId], TagSize)) {
            aes.Encrypt(nonce, plaintext, ciphertext, tag, Encoding.UTF8.GetBytes(cookieName));
        }

        var buffer = new byte[2 + keyId.Length + NonceSize + ciphertext.Length + TagSize];
        buffer[0] = Version;
        buffer[1] = (byte)keyId.Length;
        keyId.CopyTo(buffer, 2);
        nonce.CopyTo(buffer, 2 + keyId.Length);
        ciphertext.CopyTo(buffer, 2 + keyId.Length + NonceSize);
        tag.CopyTo(buffer, 2 + keyId.Length + NonceSize + ciphertext.Length);
        return Base64Url.EncodeToString(buffer);
    }

    /// <summary>Returns the plaintext, or an empty result for anything that is not a valid cookie of this name.</summary>
    internal ReadOnlyMemory<byte> Unprotect(string cookieName, string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > MaxCookieLength || !Base64Url.IsValid(value)) {
            return default;
        }

        var buffer = Base64Url.DecodeFromChars(value);
        if (buffer.Length < 2 || buffer[0] != Version || buffer.Length < 2 + buffer[1] + NonceSize + TagSize) {
            return default;
        }

        var keyId = Encoding.UTF8.GetString(buffer, 2, buffer[1]);
        return keyRing.Keys.TryGetValue(keyId, out var key)
            ? Decrypt(key, buffer, 2 + buffer[1], Encoding.UTF8.GetBytes(cookieName))
            : default;
    }

    private static byte[] Decrypt(byte[] key, byte[] buffer, int nonceOffset, byte[] associatedData)
    {
        var ciphertextOffset = nonceOffset + NonceSize;
        var plaintext = new byte[buffer.Length - ciphertextOffset - TagSize];
        try {
            using var aes = new AesGcm(key, TagSize);
            aes.Decrypt(buffer.AsSpan(nonceOffset, NonceSize), buffer.AsSpan(ciphertextOffset, plaintext.Length),
                buffer.AsSpan(buffer.Length - TagSize, TagSize), plaintext, associatedData);
            return plaintext;
        } catch (CryptographicException) {
            return [];
        }
    }
}
