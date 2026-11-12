using Scpp.Shared.Contact.Api;

var builder = WebApplication.CreateSlimBuilder(args);
var app = builder.Build();

app.MapGet("/", DummyEndpoint.Get);

app.Run();
