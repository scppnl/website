using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Shared.Contact.Api.Endpoints;

namespace Scpp.Shared.Contact.Api.UnitTests.Endpoints;

[TestClass]
public sealed class DummyEndpointTests
{
    [TestMethod]
    public void GetReturnsContactApiAsPlainText()
    {
        var result = DummyEndpoint.Get();

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("text/plain", result.ContentType);
        Assert.AreEqual("Contact API", result.ResponseContent);
    }
}
