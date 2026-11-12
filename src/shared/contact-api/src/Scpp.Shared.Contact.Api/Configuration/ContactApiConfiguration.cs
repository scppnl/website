using Scpp.Shared.Contact.Api.Serialization;
using Scpp.Shared.Contact.Api.Interfaces;
using Scpp.Shared.Contact.Api.Services;
using Scpp.Shared.Contact.Api.Verification;
using Scpp.Shared.Contact.Infrastructure.Logging;
using Scpp.Shared.Contact.Infrastructure.Verification;

namespace Scpp.Shared.Contact.Api.Configuration;

internal static class ContactApiConfiguration
{
    internal static void AddContactApi(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<IContactSubmissionService, ContactSubmissionService>();
        builder.Services.AddScoped<IContactSubmissionSink, ContactSubmissionSink>();
        builder.Services.AddScoped<LoggingContactSubmissionSink>();
        builder.Services.AddScoped<IContactVerificationService, ContactVerificationService>();
        builder.Services.AddHttpClient<TurnstileVerifier>(
            client => client.Timeout = TimeSpan.FromSeconds(10));
        builder.Services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.TypeInfoResolverChain.Insert(0, ContactJsonContext.Default));
        builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
        {
            var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
            if (origins.Length > 0)
            {
                policy.WithOrigins(origins).WithMethods("POST").WithHeaders("Content-Type");
            }
        }));
    }
}
