using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Scpp.Foundation.Booking.Api.UnitTests;

internal sealed class TestHostEnvironment(string name) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = name;
    public string ApplicationName { get; set; } = "BookingTests";
    public string ContentRootPath { get; set; } = "";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
