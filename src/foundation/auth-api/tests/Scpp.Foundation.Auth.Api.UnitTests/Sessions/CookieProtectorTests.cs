using System.Buffers.Text;
using System.Text;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Sessions;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Sessions;

[TestClass]
public sealed class CookieProtectorTests
{
    private static readonly byte[] Plaintext = Encoding.UTF8.GetBytes("{\"email\":\"member@scpp.nl\"}");

    [TestMethod]
    public void ProtectedValueRoundTripsAndHidesThePlaintext()
    {
        var protector = new CookieProtector(SessionKeyRing.Load(AuthTestHost.KeyRing));

        var value = protector.Protect("cookie", Plaintext);

        CollectionAssert.AreEqual(Plaintext, protector.Unprotect("cookie", value).ToArray());
        Assert.DoesNotContain("member", value);
        Assert.IsTrue(Base64Url.IsValid(value));
    }

    [TestMethod]
    public void EveryProtectionUsesAFreshNonce()
    {
        var protector = new CookieProtector(SessionKeyRing.Load(AuthTestHost.KeyRing));

        Assert.AreNotEqual(protector.Protect("cookie", Plaintext), protector.Protect("cookie", Plaintext));
    }

    [TestMethod]
    public void CookieNameIsAuthenticated()
    {
        var protector = new CookieProtector(SessionKeyRing.Load(AuthTestHost.KeyRing));

        var value = protector.Protect("cookie-a", Plaintext);

        Assert.IsTrue(protector.Unprotect("cookie-b", value).IsEmpty);
    }

    [TestMethod]
    public void AnyChangedByteInvalidatesTheCookie()
    {
        var protector = new CookieProtector(SessionKeyRing.Load(AuthTestHost.KeyRing));
        var bytes = Base64Url.DecodeFromChars(protector.Protect("cookie", Plaintext));

        for (var i = 0; i < bytes.Length; i++) {
            var copy = (byte[])bytes.Clone();
            copy[i] ^= 0x01;
            Assert.IsTrue(protector.Unprotect("cookie", Base64Url.EncodeToString(copy)).IsEmpty, $"byte {i}");
        }
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow("%%%")]
    [DataRow("AA")]
    [DataRow("AQA")]
    public void GarbageIsRejectedWithoutThrowing(string? value)
    {
        var protector = new CookieProtector(SessionKeyRing.Load(AuthTestHost.KeyRing));

        Assert.IsTrue(protector.Unprotect("cookie", value).IsEmpty);
    }

    [TestMethod]
    public void OversizedValueIsRejected()
    {
        var protector = new CookieProtector(SessionKeyRing.Load(AuthTestHost.KeyRing));

        Assert.IsTrue(protector.Unprotect("cookie", new string('A', 5000)).IsEmpty);
    }

    [TestMethod]
    public void OldKeyStillDecryptsAfterRotationButARemovedKeyDoesNot()
    {
        var oldRing = SessionKeyRing.Load("{\"activeKeyId\":\"k1\",\"keys\":{\"k1\":\"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=\"}}");
        var value = new CookieProtector(oldRing).Protect("cookie", Plaintext);
        var rotated = new CookieProtector(SessionKeyRing.Load(AuthTestHost.KeyRing));
        var removed = new CookieProtector(SessionKeyRing.Load(
            "{\"activeKeyId\":\"k3\",\"keys\":{\"k3\":\"QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8=\"}}"));

        CollectionAssert.AreEqual(Plaintext, rotated.Unprotect("cookie", value).ToArray());
        Assert.IsTrue(removed.Unprotect("cookie", value).IsEmpty);
    }

    [TestMethod]
    public void NewCookiesUseTheActiveKey()
    {
        var protector = new CookieProtector(SessionKeyRing.Load(AuthTestHost.KeyRing));

        var bytes = Base64Url.DecodeFromChars(protector.Protect("cookie", Plaintext));

        Assert.AreEqual(2, bytes[1]);
        Assert.AreEqual("k2", Encoding.UTF8.GetString(bytes, 2, bytes[1]));
    }
}
