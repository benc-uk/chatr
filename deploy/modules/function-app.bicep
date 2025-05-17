param name string
param location string = resourceGroup().location
param storageAccountName string
param appInsightsName string
param pubSubName string

var storeSuffix = environment().suffixes.storage

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-10-01-preview' existing = {
  name: pubSubName
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
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: flexFuncPlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_AUTHENTICATION_STRING'
          value: 'Authorization=AAD'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: 'https://${storageAccountName}.blob.${storeSuffix}'
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: 'https://${storageAccountName}.queue.${storeSuffix}'
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: 'https://${storageAccountName}.table.${storeSuffix}'
        }
        { name: 'PUBSUB_ENDPOINT', value: 'https://${pubSubName}.webpubsub.azure.com' }
        { name: 'PUBSUB_HUB', value: 'chat' }
        { name: 'STORAGE_ACCOUNT_NAME', value: storageAccountName }
      ]
      minTlsVersion: '1.2'
    }
    httpsOnly: true
    functionAppConfig: {
      runtime: {
        name: 'node'
        version: '22'
      }
      deployment: {
        storage: {
          authentication: {
            type: 'SystemAssignedIdentity'
          }
          type: 'blobContainer'
          value: 'https://${storageAccountName}.blob.${storeSuffix}/deployment-packages'
        }
      }
      scaleAndConcurrency: { instanceMemoryMB: 512, maximumInstanceCount: 40 }
    }
  }
}

// Role assignment for the function app to access the storage account
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, 'Storage Blob Data Contributor', storage.id)
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
  scope: storage
}

// Role assignment for the function app to access the storage account table
resource tableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, 'Storage Table Data Contributor', storage.id)
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
  scope: storage
}

// Add role assignment for the function app to access app insights
resource appInsightsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, 'Monitoring Metrics Publisher', appInsights.id)
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
  scope: appInsights
}

// Add role assignment for the function app to access the web pub sub
resource webPubSubRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, 'Web PubSub Service Owner', functionApp.id)
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '12cf5a90-567b-43ae-8102-96cf46c7d9b4')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
  scope: webPubSub
}

output principalId string = functionApp.identity.principalId
output functionAppName string = functionApp.name
output functionAppHostname string = functionApp.properties.defaultHostName
output functionAppId string = functionApp.id // Added: Output function app resource ID
output location string = location
