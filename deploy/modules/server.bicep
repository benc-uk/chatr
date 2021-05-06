param location string = 'westeurope'
param containerName string = 'chatrsrv2'
param dnsPrefix string = 'chatrsrv2'
param serverImage string = 'ghcr.io/benc-uk/chatr/server:latest'

param pubsubConnString string
param storageAccount string
param storageKey string
param storageShare string

var caddyImage = 'caddy:latest'

resource serverContainer 'Microsoft.ContainerInstance/containerGroups@2021-03-01' = {
  location: location
  name: containerName

  properties: {
    osType: 'Linux'
    containers: [
      // Main chatr server container 
      {
        name: 'server'
        properties:{
          image: serverImage
          environmentVariables: [
            {
              name: 'PUBSUB_CONNECTION_STRING'
              value: pubsubConnString
            }
            {
              name: 'STORAGE_ACCOUNT_NAME'
              value: storageAccount
            }
            {
              name: 'STORAGE_ACCOUNT_KEY'
              value: storageKey
            }                        
          ]

          resources: {
            requests:{
              cpu: '0.3'
              memoryInGB: '0.2'
            }
          }
        }
      }

      // Second container is a sidecare which can provide TLS
      {
        name: 'caddy-sidecar'
        properties: {
          image: caddyImage
          command: [
            'caddy'
            'reverse-proxy'
             '--from'
            '${dnsPrefix}.${location}.azurecontainer.io' 
            '--to' 
            'localhost:3000'
          ]
          ports: [
            {
              port: 443
            }
            {
              port: 80
            }
          ]
          resources: {
            requests:{
              cpu: '0.2'
              memoryInGB: '0.2'
            }
          }
          volumeMounts: [
            {
              mountPath: '/data'
              name: 'caddyvolume'
            }
          ]
        }
      }
    ]

    // Hold data for Caddy sidecar
    volumes: [
      {
        name: 'caddyvolume'
        azureFile: {
          shareName: 'caddydata'
          storageAccountKey: storageKey
          storageAccountName: storageAccount
        }
      }
    ]

    // Expose TLS / HTTPS, I think plain HTTP is still needed for LetEncrypt negotiation
    ipAddress: {
      type: 'Public'
      dnsNameLabel: dnsPrefix
      ports:[
        {
          port: 80
        }
        {
          port: 443
        }
      ]
    }
  }
}
