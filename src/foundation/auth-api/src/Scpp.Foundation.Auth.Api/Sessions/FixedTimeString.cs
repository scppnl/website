using System.Security.Cryptography;
using System.Text;

namespace Scpp.Foundation.Auth.Api.Sessions;

internal static class FixedTimeString
{
    internal static bool AreEqual(string left, string right) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(left), Encoding.UTF8.GetBytes(right));
}
