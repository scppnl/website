using Scpp.Shared.Contact.Api.Serialization;
using Scpp.Shared.Contact.Application.Interfaces;
using Scpp.Shared.Contact.Application.Services;
using Scpp.Shared.Contact.Infrastructure.Logging;

namespace Scpp.Shared.Contact.Api.Configuration;

internal static class ContactApiConfiguration
{
    internal static void AddContactApi(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<IContactSubmissionService, ContactSubmissionService>();
        builder.Services.AddScoped<IContactSubmissionSink, LoggingContactSubmissionSink>();
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
