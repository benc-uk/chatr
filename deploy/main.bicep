targetScope = 'subscription'

param resPrefix string = 'chatr'
param resGroupName string = 'chatr'
param location string = 'westeurope'

// Required params
param githubRepo string 
@secure()
param githubToken string

var storageName = '${resPrefix}store'

resource resGroup 'Microsoft.Resources/resourceGroups@2021-01-01' = {
  name: resGroupName
  location: location  
}

module staticApp 'modules/static-webapp.bicep' = {
  scope: resGroup
  name: 'staticApp'
  params: {
    name: resPrefix
    location: location
    repoToken: githubToken
    repoUrl: replace(githubRepo, '.git', '')
  }
}

module storage 'modules/storage.bicep' = {
  scope: resGroup
  name: 'storage'
  params: {
    name: storageName
    location: location
  }
}

module pubsub 'modules/pubsub.bicep' = {
  scope: resGroup
  name: 'pubsub'
  params: {
    name: resPrefix
    location: location
    eventHandlerUrl: 'https://${staticApp.outputs.appHostname}/api/eventHandler'
  }
}

// TODO: Add principals to storage
output appUrl string = 'https://${staticApp.outputs.appHostname}'
output pubSubConnStr string = 'Endpoint=https://${resPrefix}.webpubsub.azure.com;AccessKey=${pubsub.outputs.key};Version=1.0;'
