using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Foundation.Booking.Api.Endpoints;

namespace Scpp.Foundation.Booking.Api.UnitTests;

[TestClass]
public sealed class DummyEndpointTests
{
    [TestMethod]
    public void GetReturnsBookingApiAsPlainText()
    {
        var result = DummyEndpoint.Get();

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("text/plain", result.ContentType);
        Assert.AreEqual("Booking API", result.ResponseContent);
    }
}
