# syntax=docker/dockerfile:1.5
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY SEB.Web.csproj ./

# restore packages from project file
RUN dotnet restore SEB.Web.csproj

COPY . .
RUN dotnet publish SEB.Web.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["dotnet", "SEB.Web.dll"]
