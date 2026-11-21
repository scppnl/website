using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Configuration;

[TestClass]
public sealed class SessionKeyRingTests
{
    private static readonly string Key = Convert.ToBase64String(new byte[32]);

    [TestMethod]
    public void LoadsTheActiveKeyAndOlderKeys()
    {
        var ring = SessionKeyRing.Load(AuthTestHost.KeyRing);

        Assert.AreEqual("k2", ring.ActiveKeyId);
        CollectionAssert.AreEquivalent(new[] { "k1", "k2" }, ring.Keys.Keys.ToArray());
        Assert.IsTrue(ring.Keys.Values.All(key => key.Length == 32));
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow("not json")]
    [DataRow("{}")]
    [DataRow("{\"activeKeyId\":\"k1\"}")]
    [DataRow("{\"activeKeyId\":\"k1\",\"keys\":{}}")]
    [DataRow("{\"activeKeyId\":\"missing\",\"keys\":{\"k1\":\"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\"}}")]
    [DataRow("{\"activeKeyId\":\"k1\",\"keys\":{\"k1\":\"AAAA\"}}")]
    [DataRow("{\"activeKeyId\":\"k1\",\"keys\":{\"k1\":\"%%%not-base64%%%\"}}")]
    [DataRow("{\"activeKeyId\":\"bad id\",\"keys\":{\"bad id\":\"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\"}}")]
    public void MalformedKeyRingIsRejected(string? json)
    {
        var exception = Assert.ThrowsExactly<InvalidOperationException>(() => SessionKeyRing.Load(json));

        Assert.DoesNotContain(Key, exception.Message);
    }
}
