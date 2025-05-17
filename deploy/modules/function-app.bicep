param name string
param location string = resourceGroup().location
param storageAccountName string
param appInsightsName string
param pubSubConnectionString string
param deploymentStorageContainerName string = 'function-releases' // Added: Parameter for deployment package container

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

resource flexFuncPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${name}-plan'
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1' // Flex Consumption SKU
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true // Required for Linux plans
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: name
  location: location
  kind: 'functionapp,linux' // Specify linux for Flex Consumption if that's the target
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: flexFuncPlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'PubSubConnectionString'
          value: pubSubConnectionString
        }
        // Example: Setting for Node.js version if needed, though often managed by functionAppConfig.runtime
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '22'
        }
      ]
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentStorageContainerName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      runtime: {
        name: 'node'
        version: '22'
      }
      scaleAndConcurrency: { instanceMemoryMB: 512, maximumInstanceCount: 2 }
    }
  }
}

output principalId string = functionApp.identity.principalId
output functionAppName string = functionApp.name
output functionAppHostname string = functionApp.properties.defaultHostName
output functionAppId string = functionApp.id // Added: Output function app resource ID
output location string = location
