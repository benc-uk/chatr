targetScope = 'subscription'

param resSuffix string = 'chatr'
param resGroupName string = 'chatr'
param location string = 'westeurope'
param serverImage string = 'ghcr.io/benc-uk/chatr/server:latest'

// Required params
param githubRepo string 
@secure()
param githubToken string

var storageName = '${resSuffix}store'
var shareName = 'caddydata'

resource resGroup 'Microsoft.Resources/resourceGroups@2021-01-01' = {
  name: resGroupName
  location: location  
}

module staticApp 'modules/static-webapp.bicep' = {
  scope: resGroup
  name: resSuffix
  params:{
    repoToken: githubToken
    repoUrl: replace(githubRepo, '.git', '')
  }
}

// module storage 'modules/storage.bicep' = {
//   scope: resGroup
//   name: 'storage'
//   params: {
//     location: location
//     name: storageName
//     shareName: shareName
//   }
// }

// module pubsub 'modules/pubsub.bicep' = {
//   scope: resGroup
//   name: 'pubsub'
//   params: {
//     location: location
//     name: resSuffix
//     eventHandlerUrl: 'https://${resSuffix}.${location}.azurecontainer.io/pubsub/events'
//   }
// }

// module network 'modules/server.bicep' = {
//   scope: resGroup
//   name: 'server'
//   params: {
//     location: location
//     containerName: resSuffix
//     dnsPrefix: resSuffix
    
//     storageAccount: storageName
//     storageKey: storage.outputs.key
//     storageShare: shareName

//     pubsubConnString: 'Endpoint=https://${resSuffix}.webpubsub.azure.com;AccessKey=${pubsub.outputs.key};Version=1.0;'
//   }
// }

output appUrl string = staticApp.outputs.appHostname
