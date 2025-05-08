param location string = 'westeurope'
param name string = 'chatr'
param sku string = 'Free_F1'
param eventHandlerUrl string

resource pubsub 'Microsoft.SignalRService/webPubSub@2021-09-01-preview' = {
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
output hostName string = pubsub.properties.hostName
output pubSubConnStr string = 'Endpoint=https://${pubsub.properties.hostName};AccessKey=${listkeys(pubsub.id, pubsub.apiVersion).primaryKey};Version=1.0;'
