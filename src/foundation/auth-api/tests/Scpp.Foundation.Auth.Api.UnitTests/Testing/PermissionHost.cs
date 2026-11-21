using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Scpp.Foundation.Auth.Api.Sessions;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

/// <summary>A test host with two configured permissions, and helpers to sign in and read the permissions back.</summary>
internal static class PermissionHost
{
    internal const string BookingsGroup = "website-bookings@scpp.nl";
    internal const string ContactGroup = "website-contact@scpp.nl";

    /// <summary><c>bookings.manage</c> comes from the bookings group; <c>contact.read</c> from either group.</summary>
    internal static async Task<AuthTestHost> StartAsync(params string[] groups)
    {
        var host = await AuthTestHost.StartAsync(Configure);
        host.Google.Groups = groups;
        return host;
    }

    internal static async Task<string> SignInAsync(AuthTestHost host, string email = "member@scpp.nl")
    {
        using var response = await host.SignInAsync(new IdTokenClaims { Email = email });
        Assert.AreEqual(HttpStatusCode.Redirect, response.StatusCode);
        return $"{AuthCookies.Session}={ResponseCookies.Value(response, AuthCookies.Session)}";
    }

    internal static async Task<string[]> PermissionsAsync(AuthTestHost host, string cookie)
    {
        using var response = await host.GetAsync("/auth/session", cookie);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("permissions").EnumerateArray().Select(item => item.GetString()!).ToArray();
    }

    private static void Configure(WebApplicationBuilder builder)
    {
        var configuration = builder.Configuration;
        configuration["Auth:Permissions:0:Name"] = "bookings.manage";
        configuration["Auth:Permissions:0:Groups:0"] = BookingsGroup;
        configuration["Auth:Permissions:1:Name"] = "contact.read";
        configuration["Auth:Permissions:1:Groups:0"] = BookingsGroup;
        configuration["Auth:Permissions:1:Groups:1"] = ContactGroup;
    }
}
