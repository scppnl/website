namespace Scpp.Foundation.Auth.Api.Google;

internal static class GoogleEndpoints
{
    internal const string Authorization = "https://accounts.google.com/o/oauth2/v2/auth";
    internal const string Token = "https://oauth2.googleapis.com/token";
    internal const string Discovery = "https://accounts.google.com/.well-known/openid-configuration";
    internal const string MetadataClient = "google-oidc-metadata";

    /// <summary>Cloud Run's metadata server, which issues access tokens for the service's own service account.</summary>
    internal const string MetadataToken = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

    /// <summary>The only scope the service account asks for: reading group memberships.</summary>
    internal const string GroupsScope = "https://www.googleapis.com/auth/cloud-identity.groups.readonly";

    internal const string TransitiveGroups = "https://cloudidentity.googleapis.com/v1/groups/-/memberships:searchTransitiveGroups";

    /// <summary>The label that Workspace puts on security groups, and only on those.</summary>
    internal const string SecurityGroupLabel = "cloudidentity.googleapis.com/groups.security";

    /// <summary>The named HTTP client for the metadata server and the Cloud Identity API.</summary>
    internal const string CloudClient = "google-cloud";
}
