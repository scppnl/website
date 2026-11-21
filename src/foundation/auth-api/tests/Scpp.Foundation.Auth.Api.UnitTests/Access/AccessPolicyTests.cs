using Microsoft.Extensions.Configuration;
using Scpp.Foundation.Auth.Api.Access;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.UnitTests.Testing;

namespace Scpp.Foundation.Auth.Api.UnitTests.Access;

[TestClass]
public sealed class AccessPolicyTests
{
    [TestMethod]
    [DataRow("a@scpp.nl", "scpp.nl", "Allowed")]
    [DataRow("a@blokhutdewildert.nl", "scpp.nl", "Allowed")]
    [DataRow("a@blokhutdewildert.nl", "blokhutdewildert.nl", "Allowed")]
    [DataRow("A@SCPP.NL", "SCPP.NL", "Allowed")]
    [DataRow("a@scpp.nl", null, "WrongDomain")]
    [DataRow("a@scpp.nl", "", "WrongDomain")]
    [DataRow("a@gmail.com", "scpp.nl", "WrongDomain")]
    [DataRow("a@scpp.nl", "gmail.com", "WrongDomain")]
    [DataRow("a@x.scpp.nl", "scpp.nl", "WrongDomain")]
    [DataRow("a@evilscpp.nl", "scpp.nl", "WrongDomain")]
    [DataRow("a@scpp.nl.evil.example", "scpp.nl", "WrongDomain")]
    [DataRow("scpp.nl", "scpp.nl", "WrongDomain")]
    [DataRow("@scpp.nl", "scpp.nl", "WrongDomain")]
    [DataRow("a@evil.example@scpp.nl", "scpp.nl", "WrongDomain")]
    [DataRow("a@scpp.nl@evil.example", "scpp.nl", "WrongDomain")]
    [DataRow("a@", "scpp.nl", "WrongDomain")]
    [DataRow("someone@blo\u212Ahutdewildert.nl", "scpp.nl", "WrongDomain")]
    [DataRow("someone@scpp.nl", "blo\u212Ahutdewildert.nl", "WrongDomain")]
    [DataRow("someone@scpp.nl", "scpp.nl.", "WrongDomain")]
    public void DomainRulesRequireHostedDomainAndEmailDomainToBeAllowed(string email, string? hostedDomain, string expected)
    {
        Assert.AreEqual(expected, Policy().Evaluate(hostedDomain, email).ToString());
    }

    [TestMethod]
    public void AllowListRestrictsAccountsInsideTheAllowedDomains()
    {
        var policy = Policy("beheer@scpp.nl");

        Assert.AreEqual(AccessDecision.Allowed, policy.Evaluate("scpp.nl", "Beheer@scpp.nl"));
        Assert.AreEqual(AccessDecision.NotAuthorized, policy.Evaluate("scpp.nl", "member@scpp.nl"));
        Assert.AreEqual(AccessDecision.WrongDomain, policy.Evaluate(null, "beheer@scpp.nl"));
    }

    private static AccessPolicy Policy(params string[] emails)
    {
        var values = new Dictionary<string, string?>
        {
            ["AUTH_GOOGLE_CLIENT_SECRET"] = "secret",
            ["Auth:Google:ClientId"] = AuthTestHost.ClientId,
            ["Auth:ApiOrigin"] = "https://auth.example.org",
            ["Auth:FrontendOrigin"] = "https://frontend.example.org",
            ["Auth:AllowedDomains:0"] = "scpp.nl",
            ["Auth:AllowedDomains:1"] = "blokhutdewildert.nl",
        };
        for (var i = 0; i < emails.Length; i++) {
            values[$"Auth:AllowedEmails:{i}"] = emails[i];
        }

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        return new AccessPolicy(AuthSettings.Load(configuration, new TestHostEnvironment("Production")));
    }
}
