using Scpp.Shared.ContactApi;

var builder = WebApplication.CreateSlimBuilder(args);
builder.AddApiLogging();
var app = builder.Build();

app.UseApiRequestLogging();
app.MapGet("/", DummyEndpoint.Get);

app.Run();
