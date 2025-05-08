targetScope = 'subscription'

param resPrefix string = 'chatr'
param resGroupName string = 'chatr'
param location string = 'westeurope'
param appInsightsName string = '${resPrefix}-insights' // Added: Parameter for App Insights name

// Required params
param githubRepo string
@secure()
param githubToken string

var storageName = '${resPrefix}store'
var storageTableDataContributorRoleDefId = resourceId(
  'Microsoft.Authorization/roleDefinitions',
  '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
)
var storageBlobDataReaderRoleDefId = resourceId(
  'Microsoft.Authorization/roleDefinitions',
  '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
)
var storageBlobDataOwnerRoleDefId = resourceId(
  'Microsoft.Authorization/roleDefinitions',
  'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
)

var functionAppName = '${resPrefix}-func'
var deploymentStorageContainerName = 'function-releases' // Added: Define container name for consistency
var expectedFunctionAppHostname = '${functionAppName}.azurewebsites.net' // Deterministic hostname

resource resGroup 'Microsoft.Resources/resourceGroups@2021-01-01' = {
  name: resGroupName
  location: location
}

module staticApp 'modules/static-webapp.bicep' = {
  scope: resGroup
  name: 'staticAppModule' // Renamed for clarity if needed, or keep as 'staticApp'
  params: {
    name: resPrefix // This will be the SWA name, e.g., 'chatr'
    location: location
    repoToken: githubToken
    repoUrl: replace(githubRepo, '.git', '')
    // functionAppHostname removed, linking is done separately
  }
}

module storage 'modules/storage.bicep' = {
  scope: resGroup
  name: 'storageModule'
  params: {
    name: storageName
    location: location
    deploymentPackageContainerName: deploymentStorageContainerName // Added: Pass container name
  }
}

// Deploy PubSub first, as FunctionApp will need its connection string
// PubSub's eventHandlerUrl uses the *expected* Function App hostname, not an output, to break cycle
module pubsub 'modules/pubsub.bicep' = {
  scope: resGroup
  name: 'pubsubModule'
  params: {
    name: resPrefix
    location: location
    eventHandlerUrl: 'https://${expectedFunctionAppHostname}/api/eventHandler'
  }
  dependsOn: [] // No module dependencies for its parameters based on outputs
}

// Deploy Function App, depends on storage and pubsub
module functionApp 'modules/function-app.bicep' = {
  scope: resGroup
  name: 'functionAppModule'
  params: {
    name: functionAppName
    location: location
    storageAccountName: storage.outputs.storageAccountName
    appInsightsName: appInsightsName
    pubSubConnectionString: pubsub.outputs.pubSubConnStr
    deploymentStorageContainerName: deploymentStorageContainerName
  }
}

module link 'modules/link.bicep' = {
  scope: resGroup
  name: 'link'
  params: {
    functionsResourceId: functionApp.outputs.functionAppId
    staticWebAppName: resPrefix
  }
}

// Assign roles to Function App's Managed Identity on Storage for AzureWebJobsStorage
module assignRoleFuncStorageBlobOwner 'modules/role-assignment.bicep' = {
  scope: resGroup
  name: guid(resGroup.id, functionAppName, storageName, 'FuncStorageBlobOwner')
  params: {
    principalId: functionApp.outputs.principalId
    roleDefinitionId: storageBlobDataOwnerRoleDefId
    roleAssignmentName: guid(resGroup.id, functionAppName, storageName, 'FuncStorageBlobOwner')
    storageAccountName: storageName
  }
}

module assignRoleFuncStorageTableContributor 'modules/role-assignment.bicep' = {
  scope: resGroup
  name: guid(resGroup.id, functionAppName, storageName, 'FuncStorageTableContributor')
  params: {
    principalId: functionApp.outputs.principalId
    roleDefinitionId: storageTableDataContributorRoleDefId
    roleAssignmentName: guid(
      functionApp.outputs.functionAppName,
      guid(resGroup.id, functionAppName, storageName, 'FuncStorageTableContributor'),
      storageTableDataContributorRoleDefId
    )
    storageAccountName: storageName
  }
}

// Assign role to Function App's Managed Identity on Storage for Deployment Package access
module assignRoleFuncDeploymentReader 'modules/role-assignment.bicep' = {
  scope: resGroup
  name: guid(resGroup.id, functionAppName, storageName, 'FuncDeploymentReader')
  params: {
    principalId: functionApp.outputs.principalId
    roleDefinitionId: storageBlobDataReaderRoleDefId // Reader role for deployment packages
    roleAssignmentName: guid(resGroup.id, functionAppName, storageName, 'FuncDeploymentReader')
    storageAccountName: storage.outputs.storageAccountName
    // To scope this to the container, role-assignment.bicep would need to support it,
    // or we'd need a specific resource for container-level role assignment.
    // For now, assigning at storage account level for simplicity.
  }
}

output appUrl string = 'https://${staticApp.outputs.appHostname}'
output pubSubConnStr string = pubsub.outputs.pubSubConnStr // Use direct output from pubsub module
output storageAccountName string = storage.outputs.storageAccountName // Corrected to use storage module output
output functionAppPrincipalId string = functionApp.outputs.principalId
output functionAppNameOutput string = functionApp.outputs.functionAppName
