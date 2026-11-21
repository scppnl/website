using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

internal sealed class TestHostEnvironment(string name) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = name;
    public string ApplicationName { get; set; } = "AuthTests";
    public string ContentRootPath { get; set; } = "";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
