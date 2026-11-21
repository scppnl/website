using Microsoft.Extensions.Configuration;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Configuration;

[TestClass]
public sealed class AuthSettingsTests
{
    [TestMethod]
    public void ValidConfigurationIsLoadedAndNormalized()
    {
        var settings = AuthSettings.Load(Configure(("Auth:AllowedDomains:0", "SCPP.nl"), ("Auth:AllowedEmails:0", "Beheer@Scpp.nl")),
            new TestHostEnvironment("Production"));

        Assert.AreEqual("https://auth.example.org/auth/google/callback", settings.CallbackUri.AbsoluteUri);
        Assert.AreEqual("https://frontend.example.org/inloggen/geen-toegang", settings.FrontendUri(AuthSettings.AccessDeniedPath).AbsoluteUri);
        Assert.IsTrue(settings.AllowedDomains.SetEquals(["scpp.nl", "blokhutdewildert.nl"]));
        Assert.IsTrue(settings.AllowedEmails.SetEquals(["beheer@scpp.nl"]));
    }

    [TestMethod]
    [DataRow("AUTH_GOOGLE_CLIENT_SECRET", null)]
    [DataRow("AUTH_GOOGLE_CLIENT_SECRET", " ")]
    [DataRow("Auth:Google:ClientId", null)]
    [DataRow("Auth:Google:ClientId", "client-without-the-google-suffix")]
    [DataRow("Auth:ApiOrigin", null)]
    [DataRow("Auth:ApiOrigin", "https://auth.example.org/path")]
    [DataRow("Auth:ApiOrigin", "https://auth.example.org/")]
    [DataRow("Auth:ApiOrigin", "https://user:pass@auth.example.org")]
    [DataRow("Auth:ApiOrigin", "http://auth.example.org")]
    [DataRow("Auth:ApiOrigin", "https://localhost")]
    [DataRow("Auth:ApiOrigin", "not a url")]
    [DataRow("Auth:FrontendOrigin", "http://frontend.example.org")]
    [DataRow("Auth:FrontendOrigin", "https://127.0.0.1")]
    [DataRow("Auth:PostSignInPath", "beheer")]
    [DataRow("Auth:PostSignInPath", "//evil.example")]
    [DataRow("Auth:PostSignInPath", "/\\evil.example")]
    [DataRow("Auth:AllowedDomains:1", "*.scpp.nl")]
    [DataRow("Auth:AllowedDomains:1", "not a hostname")]
    [DataRow("Auth:AllowedDomains:1", "localhost")]
    [DataRow("Auth:AllowedEmails:0", "no-at-sign")]
    public void InvalidConfigurationIsRejectedAtStartup(string key, string? value)
    {
        var configuration = Configure((key, value));

        var exception = Assert.ThrowsExactly<InvalidOperationException>(() =>
            AuthSettings.Load(configuration, new TestHostEnvironment("Production")));

        Assert.DoesNotContain("test-client-secret", exception.Message);
    }

    [TestMethod]
    public void NoDomainsIsRejected()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(Values().Where(pair => !pair.Key.StartsWith("Auth:AllowedDomains", StringComparison.Ordinal))).Build();

        Assert.ThrowsExactly<InvalidOperationException>(() => AuthSettings.Load(configuration, new TestHostEnvironment("Production")));
    }

    [TestMethod]
    public void DevelopmentMayUseLocalhostOverHttpButProductionMayNot()
    {
        var local = Configure(("Auth:ApiOrigin", "http://localhost:5082"), ("Auth:FrontendOrigin", "http://localhost:4200"));

        var settings = AuthSettings.Load(local, new TestHostEnvironment("Development"));

        Assert.AreEqual("http://localhost:5082/auth/google/callback", settings.CallbackUri.AbsoluteUri);
        Assert.ThrowsExactly<InvalidOperationException>(() => AuthSettings.Load(local, new TestHostEnvironment("Production")));
    }

    [TestMethod]
    public void DevelopmentStillRejectsPlainHttpToARemoteHost()
    {
        var remote = Configure(("Auth:ApiOrigin", "http://auth.example.org"));

        Assert.ThrowsExactly<InvalidOperationException>(() => AuthSettings.Load(remote, new TestHostEnvironment("Development")));
    }

    private static Dictionary<string, string?> Values() => new()
    {
        ["AUTH_GOOGLE_CLIENT_SECRET"] = "test-client-secret",
        ["Auth:Google:ClientId"] = AuthTestHost.ClientId,
        ["Auth:ApiOrigin"] = "https://auth.example.org",
        ["Auth:FrontendOrigin"] = "https://frontend.example.org",
        ["Auth:PostSignInPath"] = "/beheer",
        ["Auth:AllowedDomains:0"] = "scpp.nl",
        ["Auth:AllowedDomains:1"] = "blokhutdewildert.nl",
    };

    private static IConfiguration Configure(params (string Key, string? Value)[] overrides)
    {
        var values = Values();
        foreach (var (key, value) in overrides) {
            values[key] = value;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }
}
