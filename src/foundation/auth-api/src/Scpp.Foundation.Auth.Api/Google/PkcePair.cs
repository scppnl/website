using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace Scpp.Foundation.Auth.Api.Google;

internal sealed record PkcePair(string Verifier, string Challenge)
{
    internal static PkcePair Create()
    {
        var verifier = Random();
        var challenge = Base64Url.EncodeToString(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        return new(verifier, challenge);
    }

    /// <summary>32 random bytes, base64url-encoded; used for the verifier, state and nonce.</summary>
    internal static string Random() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
}
