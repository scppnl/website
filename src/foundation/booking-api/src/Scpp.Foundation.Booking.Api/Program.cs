using Scpp.Foundation.Booking.Api;

var builder = WebApplication.CreateSlimBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, BookingJsonContext.Default));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<BookingRequestValidator>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins")
    .GetChildren().Select(origin => origin.Value).OfType<string>().ToArray();
if (allowedOrigins.Contains("*"))
    throw new InvalidOperationException("Cors:AllowedOrigins must contain explicit origins, not '*'.");
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).WithMethods("POST").WithHeaders("Content-Type")));

var app = builder.Build();

app.UseCors();
app.MapGet("/", DummyEndpoint.Get);
app.MapPost("/api/bookings", BookingEndpoint.Post);

app.Run();
