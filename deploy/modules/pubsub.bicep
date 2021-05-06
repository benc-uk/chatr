param location string = 'westeurope'
param name string = 'chatr'
param sku string = 'Free_F1'
param eventHandlerUrl string = 'https://chatrsrv2.uksouth.azurecontainer.io/api/event'

resource pubsub 'Microsoft.SignalRService/WebPubSub@2021-04-01-preview' = {
  name: name
  location: location

  sku: {
    name: sku
    capacity: 1
  }
  
  properties: {
    eventHandler: {
      items: {
        chat: [
          {
            urlTemplate: eventHandlerUrl
            userEventPattern: '*'
            systemEventPattern: 'connected,disconnected'
          }
        ]
      }
    }
  }
}

output key string = listkeys(pubsub.id, pubsub.apiVersion).primaryKey