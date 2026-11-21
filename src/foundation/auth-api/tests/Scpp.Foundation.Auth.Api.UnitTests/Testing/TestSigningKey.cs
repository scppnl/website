using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

/// <summary>An RSA key pair standing in for one of Google's signing keys.</summary>
public sealed class TestSigningKey
{
    private readonly RSA rsa = RSA.Create(2048);

    private TestSigningKey(string keyId)
    {
        SecurityKey = new RsaSecurityKey(rsa) { KeyId = keyId };
        var parameters = rsa.ExportParameters(false);
        Jwk = $"{{\"kty\":\"RSA\",\"use\":\"sig\",\"alg\":\"RS256\",\"kid\":\"{keyId}\"," +
            $"\"n\":\"{Base64UrlEncoder.Encode(parameters.Modulus)}\",\"e\":\"{Base64UrlEncoder.Encode(parameters.Exponent)}\"}}";
    }

    /// <summary>The key the stub publishes in its JWKS.</summary>
    public static TestSigningKey Primary { get; } = new("test-key-1");

    /// <summary>Same key id as <see cref="Primary"/>, but a different key: its signatures must fail.</summary>
    public static TestSigningKey Forged { get; } = new("test-key-1");

    /// <summary>A key id the JWKS does not contain.</summary>
    public static TestSigningKey Unpublished { get; } = new("unpublished-key");

    public RsaSecurityKey SecurityKey { get; }

    public string Jwk { get; }
}
