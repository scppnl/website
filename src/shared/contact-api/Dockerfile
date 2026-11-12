FROM mcr.microsoft.com/dotnet/runtime-deps:10.0-noble-chiseled-extra

WORKDIR /app
COPY artifacts/publish/contact-api/ ./

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["./Scpp.Shared.ContactApi"]
