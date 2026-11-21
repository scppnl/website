FROM mcr.microsoft.com/dotnet/runtime-deps:10.0-noble-chiseled-extra

WORKDIR /app
COPY artifacts/publish/auth-api/ ./

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["./Scpp.Foundation.Auth.Api"]
