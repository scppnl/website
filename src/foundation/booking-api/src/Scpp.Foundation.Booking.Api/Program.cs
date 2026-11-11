using Scpp.Foundation.Booking.Api;

var builder = WebApplication.CreateSlimBuilder(args);
var app = builder.Build();

app.MapGet("/", DummyEndpoint.Get);

app.Run();
