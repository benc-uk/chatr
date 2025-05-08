param location string = 'westeurope'
param name string = 'chatr'
param sku string = 'Free'
param branch string = 'main'
param repoUrl string
@secure()
param repoToken string

resource staticApp 'Microsoft.Web/staticSites@2021-02-01' = {
  name: name
  location: location

  sku: {
    name: sku
  }

  properties: {
    repositoryUrl: repoUrl
    branch: branch
    repositoryToken: repoToken
    buildProperties: {
      appLocation: 'client'
      apiLocation: 'api'
    }
  }
}

output appHostname string = staticApp.properties.defaultHostname
