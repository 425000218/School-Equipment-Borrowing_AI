# syntax=docker/dockerfile:1.5
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY *.sln .
COPY SEB.Web.csproj .

# copy project files and restore packages
RUN dotnet restore SEB.Web.csproj

COPY . .
RUN dotnet publish SEB.Web.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://0.0.0.0:3000
EXPOSE 3000
ENTRYPOINT ["dotnet", "SEB.Web.dll"]
