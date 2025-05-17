targetScope = 'subscription'

param resPrefix string = 'chatr'
param resGroupName string = 'chatr'
param location string = 'westeurope'

var appInsightsName = '${resPrefix}-insights'
var swaName = '${resPrefix}-swa'
var wpsName = '${resPrefix}-wps'
var storageName = '${resPrefix}store'
var functionAppName = '${resPrefix}-func'

resource resGroup 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resGroupName
  location: location
}

module staticApp 'modules/static-webapp.bicep' = {
  scope: resGroup
  params: {
    name: swaName
    location: location
  }
}

module storage 'modules/storage.bicep' = {
  scope: resGroup
  params: {
    name: storageName
    location: location
  }
}

module pubsub 'modules/pubsub.bicep' = {
  scope: resGroup
  params: {
    name: wpsName
    location: location
    eventHandlerUrl: 'https://${staticApp.outputs.appHostname}/api/eventHandler'
  }
}

module functionApp 'modules/function-app.bicep' = {
  scope: resGroup
  params: {
    name: functionAppName
    location: location
    storageAccountName: storage.outputs.storageAccountName
    appInsightsName: appInsightsName
    pubSubName: wpsName
  }
}

module link 'modules/link-backend.bicep' = {
  scope: resGroup
  params: {
    functionsResourceId: functionApp.outputs.functionAppId
    staticWebAppName: swaName
  }
}

output appUrl string = 'https://${staticApp.outputs.appHostname}'
