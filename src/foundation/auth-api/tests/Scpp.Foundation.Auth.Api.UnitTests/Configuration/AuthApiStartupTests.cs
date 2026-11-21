using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Configuration;

[TestClass]
public sealed class AuthApiStartupTests
{
    [TestMethod]
    public async Task WildcardCorsOriginIsRejected()
    {
        var exception = await Assert.ThrowsExactlyAsync<InvalidOperationException>(() =>
            AuthTestHost.StartAsync(builder => builder.Configuration["Cors:AllowedOrigins:1"] = "*"));

        Assert.Contains("explicit origins", exception.Message);
    }

    [TestMethod]
    public async Task FrontendOriginMustBeAllowedByCors()
    {
        var exception = await Assert.ThrowsExactlyAsync<InvalidOperationException>(() =>
            AuthTestHost.StartAsync(builder => builder.Configuration["Cors:AllowedOrigins:0"] = "https://other.example.org"));

        Assert.Contains("Auth:FrontendOrigin", exception.Message);
    }

    [TestMethod]
    public async Task MissingSessionKeysStopTheHost()
    {
        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() =>
            AuthTestHost.StartAsync(builder => builder.Configuration["AUTH_SESSION_KEYS"] = null));
    }

    [TestMethod]
    public async Task MissingClientSecretStopsTheHost()
    {
        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() =>
            AuthTestHost.StartAsync(builder => builder.Configuration["AUTH_GOOGLE_CLIENT_SECRET"] = null));
    }
}
