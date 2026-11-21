using System.Net;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class RootTests
{
    [TestMethod]
    public async Task RootReturnsAuthApiAsPlainText()
    {
        await using var host = await AuthTestHost.StartAsync();

        using var response = await host.GetAsync("/");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.AreEqual("text/plain", response.Content.Headers.ContentType!.MediaType);
        Assert.AreEqual("Auth API", await response.Content.ReadAsStringAsync());
    }
}
