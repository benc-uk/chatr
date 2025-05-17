targetScope = 'resourceGroup'

param staticWebAppName string
param functionsResourceId string

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' existing = {
  name: staticWebAppName
}

resource linkedStaticWebAppBackend 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = {
  name: 'linkedBackend'
  parent: staticWebApp
  properties: {
    backendResourceId: functionsResourceId
  }
}
