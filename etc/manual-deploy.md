# How to deploy to static web apps manually

```
export SWA_TOKEN="blah123"
```

```
docker run --rm -it -v $(pwd):/tmp/work --init mcr.microsoft.com/appsvc/staticappsclient:stable \
./bin/staticsites/StaticSitesClient upload \
--apiToken $SWA_TOKEN \
--app "/tmp/work/client" \
--api "/tmp/work/api"
```
