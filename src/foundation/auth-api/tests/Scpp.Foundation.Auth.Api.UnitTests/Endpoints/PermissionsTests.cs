using System.Net;
using System.Text.Json;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Endpoints;

[TestClass]
public sealed class PermissionsTests
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    [TestMethod]
    public async Task WithoutConfiguredPermissionsGoogleIsNeverAsked()
    {
        await using var host = await AuthTestHost.StartAsync();
        host.Google.Groups = [PermissionHost.BookingsGroup];

        var cookie = await PermissionHost.SignInAsync(host);
        using var response = await host.GetAsync("/auth/session", cookie);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual(0, body.RootElement.GetProperty("permissions").GetArrayLength());
        Assert.IsEmpty(host.Google.MetadataRequests);
        Assert.IsEmpty(host.Google.GroupRequests);
    }

    [TestMethod]
    public async Task MembersGetEveryPermissionOfTheirGroupsSortedByName()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        var cookie = await PermissionHost.SignInAsync(host);

        var permissions = await PermissionHost.PermissionsAsync(host, cookie);

        CollectionAssert.AreEqual(new[] { "bookings.manage", "contact.read" }, permissions);
    }

    [TestMethod]
    public async Task OneGroupMayGrantOnlyPartOfThePermissions()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.ContactGroup);
        var cookie = await PermissionHost.SignInAsync(host);

        var permissions = await PermissionHost.PermissionsAsync(host, cookie);

        CollectionAssert.AreEqual(new[] { "contact.read" }, permissions);
    }

    [TestMethod]
    public async Task GroupAddressesAreMatchedWithoutRegardToCase()
    {
        await using var host = await PermissionHost.StartAsync("Website-Contact@SCPP.nl");
        var cookie = await PermissionHost.SignInAsync(host);

        var permissions = await PermissionHost.PermissionsAsync(host, cookie);

        CollectionAssert.AreEqual(new[] { "contact.read" }, permissions);
    }

    [TestMethod]
    public async Task GroupsThatGrantNothingAreIgnored()
    {
        await using var host = await PermissionHost.StartAsync("mailing-list@scpp.nl");
        var cookie = await PermissionHost.SignInAsync(host);

        Assert.IsEmpty(await PermissionHost.PermissionsAsync(host, cookie));
    }

    [TestMethod]
    public async Task UnknownMemberHasNoPermissions()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        host.Google.GroupsStatus = HttpStatusCode.NotFound;
        var cookie = await PermissionHost.SignInAsync(host);

        Assert.IsEmpty(await PermissionHost.PermissionsAsync(host, cookie));
    }

    [TestMethod]
    public async Task LookupAsksForTheSecurityGroupsOfTheSignedInEmailWithTheServiceAccountToken()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);

        await PermissionHost.SignInAsync(host);

        var metadata = host.Google.MetadataRequests.Single();
        Assert.AreEqual("https://www.googleapis.com/auth/cloud-identity.groups.readonly", metadata.Scopes);
        Assert.AreEqual("Google", metadata.MetadataFlavor);
        var groups = host.Google.GroupRequests.Single();
        Assert.AreEqual("member_key_id == 'member@scpp.nl' && 'cloudidentity.googleapis.com/groups.security' in labels", groups.Query);
        Assert.AreEqual("Bearer test-access-token", groups.Authorization);
    }

    [TestMethod]
    [DataRow("o'brien@scpp.nl", "o\\'brien@scpp.nl")]
    [DataRow("back\\slash@scpp.nl", "back\\\\slash@scpp.nl")]
    public async Task QuotesAndBackslashesInTheEmailCannotLeaveTheQueryLiteral(string email, string escaped)
    {
        await using var host = await PermissionHost.StartAsync();

        await PermissionHost.SignInAsync(host, email);

        Assert.AreEqual($"member_key_id == '{escaped}' && 'cloudidentity.googleapis.com/groups.security' in labels",
            host.Google.GroupRequests.Single().Query);
    }

    [TestMethod]
    public async Task EveryPageOfGroupsIsRead()
    {
        await using var host = await PermissionHost.StartAsync("one@scpp.nl", "two@scpp.nl", PermissionHost.ContactGroup);
        host.Google.GroupsPageSize = 1;

        var cookie = await PermissionHost.SignInAsync(host);

        CollectionAssert.AreEqual(new[] { "contact.read" }, await PermissionHost.PermissionsAsync(host, cookie));
        CollectionAssert.AreEqual(new string?[] { null, "1", "2" }, host.Google.GroupRequests.Select(request => request.PageToken).ToArray());
    }

    [TestMethod]
    public async Task GroupsAreReusedUntilTheLifetimeEnds()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        var cookie = await PermissionHost.SignInAsync(host);

        await PermissionHost.PermissionsAsync(host, cookie);
        host.Clock.Advance(Lifetime - TimeSpan.FromSeconds(1));
        await PermissionHost.PermissionsAsync(host, cookie);
        Assert.HasCount(1, host.Google.GroupRequests);

        host.Clock.Advance(TimeSpan.FromSeconds(1));
        await PermissionHost.PermissionsAsync(host, cookie);
        Assert.HasCount(2, host.Google.GroupRequests);
    }

    [TestMethod]
    public async Task RemovalFromAGroupTakesEffectWhenTheLifetimeEnds()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        var cookie = await PermissionHost.SignInAsync(host);
        host.Google.Groups = [];

        CollectionAssert.AreEqual(new[] { "bookings.manage", "contact.read" }, await PermissionHost.PermissionsAsync(host, cookie));
        host.Clock.Advance(Lifetime);

        Assert.IsEmpty(await PermissionHost.PermissionsAsync(host, cookie));
    }

    [TestMethod]
    public async Task SigningInAgainAsksGoogleEvenWhenTheGroupsAreStillRemembered()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        await PermissionHost.SignInAsync(host);
        host.Google.Groups = [PermissionHost.ContactGroup];

        var cookie = await PermissionHost.SignInAsync(host);

        CollectionAssert.AreEqual(new[] { "contact.read" }, await PermissionHost.PermissionsAsync(host, cookie));
        Assert.HasCount(2, host.Google.GroupRequests);
    }

    [TestMethod]
    public async Task AccessTokenIsReusedWhileItIsValid()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        var cookie = await PermissionHost.SignInAsync(host);
        host.Clock.Advance(Lifetime);

        await PermissionHost.PermissionsAsync(host, cookie);

        Assert.HasCount(2, host.Google.GroupRequests);
        Assert.HasCount(1, host.Google.MetadataRequests);
    }

    [TestMethod]
    public async Task AccessTokenIsReplacedBeforeItExpires()
    {
        await using var host = await PermissionHost.StartAsync(PermissionHost.BookingsGroup);
        host.Google.MetadataExpiresIn = 120;
        var cookie = await PermissionHost.SignInAsync(host);
        host.Clock.Advance(Lifetime);

        await PermissionHost.PermissionsAsync(host, cookie);

        Assert.HasCount(2, host.Google.MetadataRequests);
    }
}
