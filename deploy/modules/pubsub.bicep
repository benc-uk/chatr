param location string = 'westeurope'
param name string = 'chatr'
param sku string = 'Free_F1'
param eventHandlerUrl string

resource pubSub 'Microsoft.SignalRService/webPubSub@2024-10-01-preview' = {
  name: name
  location: location

  sku: {
    name: sku
    capacity: 1
  }

  properties: {
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

// Add a hub for the chat application
resource chatHub 'Microsoft.SignalRService/webPubSub/hubs@2024-10-01-preview' = {
  name: 'chat'
  parent: pubSub
  properties: {
    eventHandlers: [
      {
        urlTemplate: eventHandlerUrl
        userEventPattern: '*'
        systemEvents: [
          'Connected'
          'Disconnected'
        ]
      }
    ]
  }
}

output hostName string = pubSub.properties.hostName
