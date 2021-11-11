param location string = 'westeurope'
param name string = 'chatr'
param sku string = 'Free_F1'
param eventHandlerUrl string

resource pubsub 'Microsoft.SignalRService/webPubSub@2021-10-01' = {
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
