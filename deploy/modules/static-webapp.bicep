param location string = 'westeurope'
param name string = 'chatr'
param sku string = 'Standard'

resource staticApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location

  sku: {
    name: sku
  }

  // No longer link to GitHub, we will deploy the app using the SWA CLI
  properties: {}
}

output appHostname string = staticApp.properties.defaultHostname
